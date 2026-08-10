import {
  Controls,
  FullscreenButton,
  MediaPlayer,
  MediaProvider,
  MuteButton,
  PlayButton,
  Poster,
  SeekButton,
  Time,
  TimeSlider,
  VolumeSlider,
  useMediaState,
  useVideoQualityOptions,
  type MediaPlayerInstance,
} from "@vidstack/react";
import "@vidstack/react/player/styles/base.css";
import {
  Captions,
  CaptionsOff,
  Lock,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Repeat1,
  Settings,
  SkipBack,
  SkipForward,
  Unlock,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import {
  DEFAULT_KID_VIDEO_PLAYER_LABELS,
  type KidVideoPlayerLabels,
} from "./kid-video-player-labels";
import {
  hardenYouTubeEmbed,
  preventOrphanedCommandPromises,
  setYouTubeCaptions,
} from "./youtube-provider-hardening";
import styles from "./kid-video-player.module.css";

/** What the hover card on a prev/next side button shows. */
export type KidVideoPlayerPreview = {
  title: string;
  thumbnailUrl: string;
  subtitle?: string;
};

/**
 * Generic kid-safe YouTube player on Vidstack's headless primitives. The
 * YouTube iframe is never interactive: a full-surface shield swallows clicks,
 * an opaque cover hides YouTube's link-out title bar, and the frame itself is
 * sandboxed without popups or top navigation. Everything a viewer can do goes
 * through the custom control bar.
 *
 * Deliberately domain-free (takes a `videoId`, not a `Video`) so it can live
 * in shared/ui; the slots let widget-layer features — gestures, up-next,
 * lock — mount inside the player without this component knowing about them.
 */
export function KidVideoPlayer({
  videoId,
  title,
  posterUrl,
  autoPlay = false,
  startMuted = false,
  startTime = 0,
  captionsEnabled = false,
  labels: labelOverrides,
  className = "",
  overlaySlot,
  controlsStartSlot,
  controlsEndSlot,
  onEnded,
  onPlayingChange,
  onTimeUpdate,
  onDurationChange,
  onError,
  onFullscreenChange,
  onNextVideo,
  onPreviousVideo,
  nextVideoPreview,
  previousVideoPreview,
}: {
  videoId: string;
  title: string;
  posterUrl?: string;
  autoPlay?: boolean;
  /** Carried into the embed URL before load, so iOS honors it. */
  startMuted?: boolean;
  /** Seconds to open at; the video resumes there once it can play. */
  startTime?: number;
  /** Initial captions state; applied once the embed can play. */
  captionsEnabled?: boolean;
  labels?: Partial<KidVideoPlayerLabels>;
  className?: string;
  /** Rendered above the shield and title cover, below the controls. */
  overlaySlot?: ReactNode;
  /** Leading edge of the control bar. */
  controlsStartSlot?: ReactNode;
  /** Trailing edge of the control bar, before the fullscreen button. */
  controlsEndSlot?: ReactNode;
  onEnded?: () => void;
  onPlayingChange?: (isPlaying: boolean) => void;
  onTimeUpdate?: (currentSeconds: number) => void;
  onDurationChange?: (seconds: number) => void;
  onError?: () => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  /** When provided, a big side button on the right edge skips forward. */
  onNextVideo?: () => void;
  /** When provided, a big side button on the left edge skips back. */
  onPreviousVideo?: () => void;
  /** Card shown while hovering or focusing the next-video button. */
  nextVideoPreview?: KidVideoPlayerPreview;
  /** Card shown while hovering or focusing the previous-video button. */
  previousVideoPreview?: KidVideoPlayerPreview;
}) {
  const labels = { ...DEFAULT_KID_VIDEO_PLAYER_LABELS, ...labelOverrides };
  const playerRef = useRef<MediaPlayerInstance>(null);
  const [areCaptionsEnabled, setAreCaptionsEnabled] =
    useState(captionsEnabled);
  const [isLocked, setIsLocked] = useState(false);
  const [isRepeatOn, setIsRepeatOn] = useState(false);
  const isRepeatOnRef = useRef(false);
  const hasResumedRef = useRef(false);

  const toggleCaptions = () => {
    const next = !areCaptionsEnabled;
    setAreCaptionsEnabled(next);
    setYouTubeCaptions(playerRef.current?.provider, next);
  };

  const toggleRepeat = () => {
    setIsRepeatOn((wasOn) => {
      isRepeatOnRef.current = !wasOn;
      return !wasOn;
    });
  };

  return (
    <MediaPlayer
      ref={playerRef}
      className={`${styles.playerBox} ${className}`.trim()}
      src={`youtube/${videoId}`}
      title={title}
      aria-label={labels.surface}
      // Stated up front rather than inferred once metadata lands, so the
      // surface is laid out as on-demand video from the first frame.
      viewType="video"
      streamType="on-demand"
      autoPlay={autoPlay}
      muted={startMuted}
      playsInline
      load="eager"
      keyDisabled={isLocked}
      onProviderChange={(provider) => {
        hardenYouTubeEmbed(provider);
        preventOrphanedCommandPromises(provider);
      }}
      onCanPlay={() => {
        // The captions module only sticks once the embed is ready.
        if (areCaptionsEnabled) {
          setYouTubeCaptions(playerRef.current?.provider, true);
        }
        // Resume where this video was left off. Guarded by a ref because the
        // embed can report it can play more than once (a stall that recovers
        // re-fires it), and a second seek would yank the viewer backwards.
        const player = playerRef.current;
        if (player && startTime > 0 && !hasResumedRef.current) {
          hasResumedRef.current = true;
          player.currentTime = startTime;
        }
      }}
      onPlay={() => onPlayingChange?.(true)}
      onPause={() => onPlayingChange?.(false)}
      onEnded={() => {
        if (isRepeatOnRef.current) {
          const player = playerRef.current;
          if (player) {
            player.currentTime = 0;
            player.play().catch(() => {});
          }
          return;
        }
        onPlayingChange?.(false);
        onEnded?.();
      }}
      onTimeUpdate={({ currentTime }) => onTimeUpdate?.(currentTime)}
      onDurationChange={(seconds) => {
        if (Number.isFinite(seconds) && seconds > 0) {
          onDurationChange?.(seconds);
        }
      }}
      onError={() => onError?.()}
      onFullscreenChange={(isFullscreen) => onFullscreenChange?.(isFullscreen)}
      onContextMenu={(event) => event.preventDefault()}
    >
      <MediaProvider />
      <Poster className={styles.poster} src={posterUrl} alt="" />
      {/*
       * Covers the embed so no click ever reaches YouTube's own surface, and
       * doubles as the tap target: anywhere on the picture starts or stops
       * playback, which is the gesture a child reaches for first. The lock
       * takes that away along with the rest of the controls. Vidstack's
       * <Gesture> would be the stock answer, but it listens on the provider
       * element underneath this layer, so it never sees the click.
       */}
      <div
        className={styles.shield}
        aria-hidden="true"
        onClick={() => {
          if (isLocked) {
            return;
          }
          const player = playerRef.current;
          if (!player) {
            return;
          }
          if (player.paused) {
            player.play().catch(() => {});
          } else {
            player.pause().catch(() => {});
          }
        }}
      />
      <div className={styles.titleCover} aria-hidden="true" />
      {overlaySlot ? <div className={styles.overlay}>{overlaySlot}</div> : null}
      {isLocked ? null : (
        <PlayerControlBar
          areCaptionsEnabled={areCaptionsEnabled}
          isRepeatOn={isRepeatOn}
          labels={labels}
          controlsStartSlot={controlsStartSlot}
          controlsEndSlot={controlsEndSlot}
          onToggleCaptions={toggleCaptions}
          onToggleRepeat={toggleRepeat}
          onNextVideo={onNextVideo}
          onPreviousVideo={onPreviousVideo}
          nextVideoPreview={nextVideoPreview}
          previousVideoPreview={previousVideoPreview}
        />
      )}
      <button
        type="button"
        className={`${styles.lockButton} ${styles.tooltipStart} ${
          isLocked ? styles.lockButtonLocked : ""
        }`.trim()}
        aria-label={isLocked ? labels.unlockControls : labels.lockControls}
        aria-pressed={isLocked}
        data-tooltip={isLocked ? labels.unlockControls : labels.lockControls}
        onClick={() => setIsLocked((wasLocked) => !wasLocked)}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        {isLocked ? <Lock size={22} /> : <Unlock size={22} />}
      </button>
    </MediaPlayer>
  );
}

/**
 * Separate component so the per-frame media state subscriptions re-render the
 * control bar alone, not the whole player tree.
 */
function PlayerControlBar({
  areCaptionsEnabled,
  isRepeatOn,
  labels,
  controlsStartSlot,
  controlsEndSlot,
  onToggleCaptions,
  onToggleRepeat,
  onNextVideo,
  onPreviousVideo,
  nextVideoPreview,
  previousVideoPreview,
}: {
  areCaptionsEnabled: boolean;
  isRepeatOn: boolean;
  labels: KidVideoPlayerLabels;
  controlsStartSlot?: ReactNode;
  controlsEndSlot?: ReactNode;
  onToggleCaptions: () => void;
  onToggleRepeat: () => void;
  onNextVideo?: () => void;
  onPreviousVideo?: () => void;
  nextVideoPreview?: KidVideoPlayerPreview;
  previousVideoPreview?: KidVideoPlayerPreview;
}) {
  const isPaused = useMediaState("paused");
  const isMuted = useMediaState("muted");
  const isFullscreen = useMediaState("fullscreen");

  return (
    <Controls.Root className={styles.controls}>
      {onPreviousVideo ? (
        <SideNavButton
          direction="left"
          label={labels.previousVideo}
          preview={previousVideoPreview}
          onClick={onPreviousVideo}
        />
      ) : null}
      {onNextVideo ? (
        <SideNavButton
          direction="right"
          label={labels.nextVideo}
          preview={nextVideoPreview}
          onClick={onNextVideo}
        />
      ) : null}
      <PlayButton
        className={`${styles.bigPlayButton} ${
          isPaused ? "" : styles.bigPlayButtonHidden
        }`.trim()}
        aria-label={labels.play}
        tabIndex={isPaused ? 0 : -1}
      >
        <Play size={34} />
      </PlayButton>
      <Controls.Group className={styles.controlsRow}>
        <TimeSlider.Root
          className={`${styles.slider} ${styles.timeSlider}`}
          aria-label={labels.seek}
        >
          <TimeSlider.Track className={styles.sliderTrack} />
          <TimeSlider.Progress className={styles.sliderBuffered} />
          <TimeSlider.TrackFill className={styles.sliderFill} />
          <TimeSlider.Thumb className={styles.sliderThumb} />
        </TimeSlider.Root>
      </Controls.Group>
      <Controls.Group className={styles.controlsRow}>
        {controlsStartSlot}
        {onPreviousVideo ? (
          <button
            type="button"
            className={`${styles.controlButton} ${styles.tooltipStart} ${styles.wideOnly}`}
            aria-label={labels.previousVideo}
            data-tooltip={labels.previousVideo}
            onClick={onPreviousVideo}
          >
            <SkipBack size={20} />
          </button>
        ) : null}
        <PlayButton
          className={styles.controlButton}
          aria-label={isPaused ? labels.play : labels.pause}
          data-tooltip={isPaused ? labels.play : labels.pause}
        >
          {isPaused ? <Play size={20} /> : <Pause size={20} />}
        </PlayButton>
        {onNextVideo ? (
          <button
            type="button"
            className={`${styles.controlButton} ${styles.wideOnly}`}
            aria-label={labels.nextVideo}
            data-tooltip={labels.nextVideo}
            onClick={onNextVideo}
          >
            <SkipForward size={20} />
          </button>
        ) : null}
        <SeekButton
          className={`${styles.controlButton} ${styles.seekStepButton} ${styles.wideOnly}`}
          seconds={-15}
          aria-label={labels.back15}
          data-tooltip={labels.back15}
        >
          −15
        </SeekButton>
        <SeekButton
          className={`${styles.controlButton} ${styles.seekStepButton} ${styles.wideOnly}`}
          seconds={15}
          aria-label={labels.forward15}
          data-tooltip={labels.forward15}
        >
          +15
        </SeekButton>
        <MuteButton
          className={styles.controlButton}
          aria-label={isMuted ? labels.unmute : labels.mute}
          data-tooltip={isMuted ? labels.unmute : labels.mute}
        >
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </MuteButton>
        <VolumeSlider.Root
          className={`${styles.slider} ${styles.volumeSlider} ${styles.wideOnly}`}
        >
          <VolumeSlider.Track className={styles.sliderTrack} />
          <VolumeSlider.TrackFill className={styles.sliderFill} />
          <VolumeSlider.Thumb className={styles.sliderThumb} />
        </VolumeSlider.Root>
        <span className={styles.timeLabel}>
          <Time type="current" />
          {"/"}
          <Time type="duration" />
        </span>
        <span className={styles.spacer} />
        <button
          type="button"
          className={`${styles.controlButton} ${styles.wideOnly}`}
          aria-label={isRepeatOn ? labels.repeatOn : labels.repeatOff}
          aria-pressed={isRepeatOn}
          data-tooltip={isRepeatOn ? labels.repeatOn : labels.repeatOff}
          onClick={onToggleRepeat}
        >
          <Repeat1 size={20} />
        </button>
        <QualityMenu label={labels.quality} />
        <button
          type="button"
          className={styles.controlButton}
          aria-label={
            areCaptionsEnabled ? labels.hideCaptions : labels.showCaptions
          }
          aria-pressed={areCaptionsEnabled}
          data-tooltip={
            areCaptionsEnabled ? labels.hideCaptions : labels.showCaptions
          }
          onClick={onToggleCaptions}
        >
          {areCaptionsEnabled ? (
            <Captions size={20} />
          ) : (
            <CaptionsOff size={20} />
          )}
        </button>
        {controlsEndSlot}
        <FullscreenButton
          className={`${styles.controlButton} ${styles.tooltipEnd}`}
          aria-label={
            isFullscreen ? labels.exitFullscreen : labels.enterFullscreen
          }
          data-tooltip={
            isFullscreen ? labels.exitFullscreen : labels.enterFullscreen
          }
        >
          {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </FullscreenButton>
      </Controls.Group>
    </Controls.Root>
  );
}

/**
 * Quality picker, rendered only when the current source actually exposes
 * qualities to choose from. YouTube embeds never do — YouTube removed manual
 * quality control from its iframe API, so there the player auto-selects and
 * this button stays hidden. It appears as soon as a source with real
 * qualities (mp4/HLS) is played.
 */
function QualityMenu({ label }: { label: string }) {
  const options = useVideoQualityOptions({ auto: true, sort: "descending" });
  const [isOpen, setIsOpen] = useState(false);

  if (options.length === 0) {
    return null;
  }

  return (
    <div className={`${styles.qualityMenu} ${styles.wideOnly}`}>
      <button
        type="button"
        className={styles.controlButton}
        aria-label={label}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        data-tooltip={isOpen ? undefined : label}
        onClick={() => setIsOpen((wasOpen) => !wasOpen)}
      >
        <Settings size={20} />
      </button>
      {isOpen ? (
        <ul className={styles.qualityList} role="menu">
          {options.map((option) => (
            <li key={option.label} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={option.selected}
                className={`${styles.qualityOption} ${
                  option.selected ? styles.qualityOptionActive : ""
                }`.trim()}
                onClick={() => {
                  option.select();
                  setIsOpen(false);
                }}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Edge button for previous/next. When a preview is given, hovering or
 * focusing the button reveals a thumbnail card of where it leads — the
 * tooltip is skipped then, since the card already says it.
 */
function SideNavButton({
  direction,
  label,
  preview,
  onClick,
}: {
  direction: "left" | "right";
  label: string;
  preview?: KidVideoPlayerPreview;
  onClick: () => void;
}) {
  const sideClass =
    direction === "left" ? styles.sideNavLeft : styles.sideNavRight;

  return (
    <div className={`${styles.sideNav} ${sideClass}`}>
      <button
        type="button"
        className={styles.sideButton}
        aria-label={label}
        data-tooltip={preview ? undefined : label}
        onClick={onClick}
      >
        {direction === "left" ? <SkipBack size={26} /> : <SkipForward size={26} />}
      </button>
      {preview ? (
        <div className={styles.previewCard} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={styles.previewThumb}
            src={preview.thumbnailUrl}
            alt=""
            loading="lazy"
          />
          <div className={styles.previewTitle}>{preview.title}</div>
          {preview.subtitle ? (
            <div className={styles.previewSubtitle}>{preview.subtitle}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
