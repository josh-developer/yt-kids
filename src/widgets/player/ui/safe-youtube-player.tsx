import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { prefetchVideo } from "@/shared/api/youtube";
import { AUTOPLAY_COUNTDOWN_SECONDS } from "@/shared/config/app-config";
import { TimerBag } from "@/shared/lib/timers";
import { useVideoLabels, type Video } from "@/entities/video";
import {
  TOUCH_AUTO_HIDE_MS,
  useControlsVisibility,
} from "../model/use-controls-visibility";
import { usePlayerEngine } from "../model/use-player-engine";
import { usePlayerFullscreen } from "../model/use-player-fullscreen";
import { usePlayerGestures } from "../model/use-player-gestures";
import { usePlayerKeyboard } from "../model/use-player-keyboard";
import { PlayerControls } from "./player-controls";
import {
  BigPlayButton,
  LockButton,
  PlayerFailureNotice,
  PlayerPoster,
  PlayerSkeleton,
  SeekHints,
  SideNavButtons,
  TitleCover,
  UpNextCountdown,
  UnmuteButton,
  VideoPreviewCard,
  type PreviewRequest,
} from "./player-overlays";
import { PlayerProgress } from "./player-progress";
import styles from "./player.module.css";

/**
 * A YouTube embed with every escape hatch closed: no YouTube controls, no
 * clickable title, no related-video grid. Playback, fullscreen, gestures and
 * key handling each live in their own hook; this component only wires them to
 * markup.
 */
export function SafeYouTubePlayer({
  isTvBrowser,
  nextVideo,
  previousVideo,
  video,
  onDurationResolved,
  onFullscreenChange,
  onNextVideo,
  onPreviousVideo,
}: {
  isTvBrowser: boolean;
  nextVideo: Video | null;
  previousVideo: Video | null;
  video: Video;
  onDurationResolved: (video: Video, seconds: number) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  onNextVideo: () => void;
  onPreviousVideo: () => void;
}) {
  const t = useTranslations("Player");
  const labels = useVideoLabels();
  const playerBoxRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isRepeatOne, setIsRepeatOne] = useState(false);
  // Which button is being hovered, plus a separate visibility flag: the card
  // stays mounted through its fade-out, and its video is re-read every render
  // so a preview under the cursor updates itself after the jump.
  const [previewDirection, setPreviewDirection] =
    useState<PreviewRequest>(null);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const repeatOneRef = useRef(false);
  const hasNextRef = useRef(false);
  // Counts down after the video ends; null whenever nothing is pending.
  const [autoplaySecondsLeft, setAutoplaySecondsLeft] = useState<number | null>(
    null,
  );
  const autoplayTimers = useRef(new TimerBag());
  // `onEnded` keeps arriving while the video sits at its last frame, so the
  // countdown has to know it is already running.
  const isCountingDownRef = useRef(false);
  const secondsLeftRef = useRef(0);

  const controls = useControlsVisibility();
  const fullscreen = usePlayerFullscreen({
    hostRef: playerBoxRef,
    onChange: onFullscreenChange,
  });

  const engine = usePlayerEngine({
    iframeRef,
    video,
    onDurationResolved,
    onEnded: () => {
      if (repeatOneRef.current) {
        engine.restart();
        return;
      }

      if (hasNextRef.current) {
        startAutoplayCountdown();
      }
    },
    onPlayingChange: (isPlaying) => controls.show({ autoHide: isPlaying }),
  });

  /**
   * The gap between one video ending and the next starting. The next video is
   * fetched the moment the count begins, so the wait doubles as its head start.
   */
  function startAutoplayCountdown() {
    if (!nextVideo || isCountingDownRef.current) {
      return;
    }

    isCountingDownRef.current = true;
    secondsLeftRef.current = AUTOPLAY_COUNTDOWN_SECONDS;
    prefetchVideo(nextVideo.videoId);
    controls.pin();
    setAutoplaySecondsLeft(AUTOPLAY_COUNTDOWN_SECONDS);

    autoplayTimers.current.interval(
      "countdown",
      () => {
        secondsLeftRef.current -= 1;

        if (secondsLeftRef.current > 0) {
          setAutoplaySecondsLeft(secondsLeftRef.current);
          return;
        }

        cancelAutoplayCountdown();
        onNextVideo();
      },
      1000,
    );
  }

  function cancelAutoplayCountdown() {
    autoplayTimers.current.clear("countdown");
    isCountingDownRef.current = false;
    setAutoplaySecondsLeft(null);
  }

  // Leaving a video ends any countdown it left running.
  useEffect(() => {
    const timers = autoplayTimers.current;
    return () => {
      timers.clearAll();
      isCountingDownRef.current = false;
      setAutoplaySecondsLeft(null);
    };
  }, [video.id]);

  useEffect(() => {
    repeatOneRef.current = isRepeatOne;
    hasNextRef.current = Boolean(nextVideo);
  }, [isRepeatOne, nextVideo]);

  /**
   * Every deliberate press goes through here. It re-arms the idle timer rather
   * than pinning the controls open: pressing things keeps them up, and a
   * viewer who stops touching gets the video back. A finger gets the longer
   * window, since it has no way to dismiss them by moving away.
   */
  function revealControls() {
    controls.show({
      autoHide: engine.isPlaying,
      delayMs: gestures.isMousePointer() ? undefined : TOUCH_AUTO_HIDE_MS,
    });
  }

  /**
   * Hover behaviour, and only hover: a real mouse over the video keeps the
   * controls up and takes them away again when it leaves, the way a desktop
   * player is expected to behave. Touch is deliberately excluded — a finger
   * "enters" and "leaves" on every tap, so letting it through here would fight
   * the tap-to-toggle handling and make the controls flicker on phones.
   */
  function isHoverPointer(pointerType: string) {
    return pointerType === "mouse" && !isLocked;
  }

  function handleHoverMove(pointerType: string) {
    if (!isHoverPointer(pointerType)) {
      return;
    }

    // Still auto-hides after a while of a motionless mouse, as YouTube does.
    controls.show({ autoHide: engine.isPlaying });
  }

  function handleHoverLeave(pointerType: string) {
    // A paused video keeps its controls: there is nothing playing to get out
    // of the way of, and the viewer is most likely coming back to them.
    if (!isHoverPointer(pointerType) || !engine.isPlaying) {
      return;
    }

    controls.hide();
  }

  function seekBy(seconds: number) {
    revealControls();
    gestures.flashSeekHint(seconds);
    engine.seekBy(seconds);
  }

  const gestures = usePlayerGestures({
    isLocked,
    isFullscreen: fullscreen.isFullscreen,
    onToggleControls: () =>
      controls.isVisible ? controls.hide() : revealControls(),
    onSeekBy: seekBy,
    onExitFullscreen: () => void fullscreen.exit(),
    onPrevious: () => {
      revealControls();
      if (previousVideo) {
        onPreviousVideo();
      }
    },
    onNext: () => {
      revealControls();
      if (nextVideo) {
        onNextVideo();
      }
    },
  });

  const handlePlayerKeyDown = usePlayerKeyboard({
    isLocked,
    isVirtualFullscreen: fullscreen.isVirtual,
    onSeekBy: seekBy,
    onToggleFullscreen: () => {
      revealControls();
      void fullscreen.toggle();
    },
    onExitFullscreen: () => {
      void fullscreen.exit();
      revealControls();
    },
    onPlayPause: () => {
      revealControls();
      engine.playPause();
    },
    onToggleMute: () => {
      revealControls();
      engine.toggleMute();
    },
    onVolumeBy: (delta) => {
      revealControls();
      engine.setVolume(engine.volume + delta);
    },
  });

  useEffect(() => {
    if (!isTvBrowser) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      playerBoxRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isTvBrowser]);

  function toggleLock() {
    setIsLocked((locked) => {
      if (locked) {
        revealControls();
      } else {
        controls.hide();
      }

      return !locked;
    });
  }

  function requestPreview(request: PreviewRequest) {
    if (request) {
      setPreviewDirection(request);
      setIsPreviewVisible(true);
      const target = request === "previous" ? previousVideo : nextVideo;
      if (target) {
        prefetchVideo(target.videoId);
      }
      return;
    }

    setIsPreviewVisible(false);
  }

  const showControls = controls.isVisible && !isLocked;
  const hasFailed = engine.failure !== null;
  const previewVideo =
    previewDirection === "previous"
      ? previousVideo
      : previewDirection === "next"
        ? nextVideo
        : null;

  return (
    <div
      className={`${styles.playerBox} ${showControls ? "" : styles.controlsHidden} ${
        fullscreen.isVirtual ? styles.virtualFullscreen : ""
      } ${isLocked ? styles.playerLocked : ""} ${
        engine.hasConfirmedPlaying ? "" : styles.awaitingStart
      }`}
      onClick={gestures.handleFrameClick}
      onDoubleClick={gestures.handleFrameDoubleClick}
      onKeyDown={(event) => handlePlayerKeyDown(event, { isTvBrowser })}
      onPointerDown={gestures.handlePointerDown}
      onPointerEnter={(event) => handleHoverMove(event.pointerType)}
      onPointerMove={(event) => handleHoverMove(event.pointerType)}
      onPointerLeave={(event) => handleHoverLeave(event.pointerType)}
      onPointerUp={gestures.handlePointerUp}
      onPointerCancel={gestures.handlePointerCancel}
      role={isTvBrowser ? "region" : undefined}
      onSelect={(event) => event.preventDefault()}
      onSelectCapture={(event) => event.preventDefault()}
      tabIndex={isTvBrowser ? 0 : undefined}
      aria-label={isTvBrowser ? t("help") : undefined}
      ref={playerBoxRef}
    >
      <iframe
        key={`${video.id}-${engine.reloadKey}`}
        aria-hidden="true"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        className={styles.youtubeMount}
        onLoad={engine.handleFrameLoad}
        ref={iframeRef}
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        src={engine.embedUrl}
        tabIndex={-1}
        title={t("surface", { title: labels.title(video) })}
        onContextMenu={(event) => event.preventDefault()}
      />

      <TitleCover isControlsVisible={controls.isVisible} />
      <PlayerSkeleton isVisible={engine.isBooting} />
      <SeekHints hint={gestures.seekHint} />

      {isLocked || controls.isVisible ? (
        <LockButton isLocked={isLocked} onToggle={toggleLock} />
      ) : null}

      {!isLocked && !hasFailed && engine.isMuted ? (
        <UnmuteButton
          onUnmute={() => {
            revealControls();
            engine.toggleMute();
          }}
        />
      ) : null}

      {isLocked ? null : (
        <SideNavButtons
          hasNext={Boolean(nextVideo)}
          hasPrevious={Boolean(previousVideo)}
          onClick={gestures.handleSideNavClick}
          onDoubleClick={gestures.handleSideNavDoubleClick}
          onPreview={requestPreview}
        />
      )}

      {previewVideo && previewDirection ? (
        <VideoPreviewCard
          direction={previewDirection}
          isVisible={isPreviewVisible && showControls}
          video={previewVideo}
        />
      ) : null}

      {/*
        Only before the first frame. Dropping it over every pause meant the
        thumbnail flashed in on each pause — and on every buffer stall.
      */}
      {engine.hasStarted ? null : <PlayerPoster videoId={video.videoId} />}

      {autoplaySecondsLeft !== null && nextVideo ? (
        <UpNextCountdown
          secondsLeft={autoplaySecondsLeft}
          totalSeconds={AUTOPLAY_COUNTDOWN_SECONDS}
          video={nextVideo}
          onPlayNow={() => {
            cancelAutoplayCountdown();
            onNextVideo();
          }}
          onReplay={() => {
            cancelAutoplayCountdown();
            engine.restart();
          }}
        />
      ) : null}

      {engine.failure ? (
        <PlayerFailureNotice
          failure={engine.failure}
          hasNext={Boolean(nextVideo)}
          onRetry={engine.retry}
          onNext={onNextVideo}
        />
      ) : null}

      {/*
        Kept mounted so it fades with the rest of the controls; unmounting it
        made it pop in and out.
      */}
      {!isLocked && !hasFailed ? (
        <BigPlayButton
          isPlaying={engine.isPlaying}
          isVisible={!engine.isPlaying || controls.isVisible}
          onClick={() => {
            revealControls();
            engine.playPause();
          }}
        />
      ) : null}

      {isLocked ? null : (
        <>
          <PlayerProgress
            clock={engine.clock}
            durationSeconds={engine.durationSeconds}
            onSeekToRatio={(ratio) => {
              revealControls();
              engine.seekToRatio(ratio);
            }}
            // Same idle rules as any other press: device-aware, and no
            // timer at all while the video is paused.
            onScrubEnd={revealControls}
          />
          <PlayerControls
            hasNext={Boolean(nextVideo)}
            hasPrevious={Boolean(previousVideo)}
            isFullscreen={fullscreen.isFullscreen}
            isMuted={engine.isMuted}
            isPlaying={engine.isPlaying}
            isRepeatOne={isRepeatOne}
            volume={engine.volume}
            onNext={onNextVideo}
            onPlayPause={() => {
              revealControls();
              engine.playPause();
            }}
            areCaptionsEnabled={engine.areCaptionsEnabled}
            onPrevious={onPreviousVideo}
            onPreview={requestPreview}
            onSeekBy={seekBy}
            onToggleCaptions={() => {
              revealControls();
              engine.toggleCaptions();
            }}
            onToggleFullscreen={() => {
              revealControls();
              void fullscreen.toggle();
            }}
            onToggleMute={() => {
              revealControls();
              engine.toggleMute();
            }}
            onToggleRepeat={() => {
              revealControls();
              setIsRepeatOne((repeat) => !repeat);
            }}
            onVolumeChange={(nextVolume) => {
              revealControls();
              engine.setVolume(nextVolume);
            }}
          />
        </>
      )}
    </div>
  );
}
