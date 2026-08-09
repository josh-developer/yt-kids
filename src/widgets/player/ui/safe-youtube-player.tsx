import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useVideoLabels, type Video } from "@/entities/video";
import { useControlsVisibility } from "../model/use-controls-visibility";
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
  UnmuteButton,
} from "./player-overlays";
import { PlayerProgress } from "./player-progress";

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
  const repeatOneRef = useRef(false);
  const hasNextRef = useRef(false);

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
        onNextVideo();
      }
    },
    onPlayingChange: (isPlaying) => controls.show({ autoHide: isPlaying }),
  });

  useEffect(() => {
    repeatOneRef.current = isRepeatOne;
    hasNextRef.current = Boolean(nextVideo);
  }, [isRepeatOne, nextVideo]);

  /**
   * Every deliberate press goes through here, and what it means depends on the
   * device. A tap pins the controls — they stay up until the next tap asks
   * them to go. A mouse press only re-arms the timer, because the mouse has
   * its own way of dismissing them by moving away; pinning on a mouse press
   * strands the controls in fullscreen, where there is no "away" to move to
   * and a viewer who then sits still never gets the video back.
   */
  function revealControls() {
    if (gestures.isMousePointer()) {
      controls.show({ autoHide: engine.isPlaying });
      return;
    }

    controls.pin();
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

  const showControls = controls.isVisible && !isLocked;
  const hasFailed = engine.failure !== null;

  return (
    <div
      className={`player-box ${showControls ? "" : "controls-hidden"} ${
        fullscreen.isVirtual ? "virtual-fullscreen" : ""
      } ${isLocked ? "player-locked" : ""}`}
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
        className="youtube-mount"
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
        />
      )}

      {/*
        Only before the first frame. Dropping it over every pause meant the
        thumbnail flashed in on each pause — and on every buffer stall.
      */}
      {engine.hasStarted ? null : <PlayerPoster videoId={video.videoId} />}

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
            currentTime={engine.currentTime}
            durationSeconds={engine.durationSeconds}
            onSeekToRatio={(ratio) => {
              revealControls();
              engine.seekToRatio(ratio);
            }}
            onScrubEnd={() => controls.scheduleHide()}
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
            onPrevious={onPreviousVideo}
            onSeekBy={seekBy}
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
