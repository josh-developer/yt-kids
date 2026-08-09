"use client";

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
  PlayerPoster,
  SeekHints,
  SideNavButtons,
  TitleCover,
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

  function revealControls() {
    controls.show({ autoHide: engine.isPlaying });
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
        controls.show({ autoHide: engine.isPlaying });
      } else {
        controls.hide();
      }

      return !locked;
    });
  }

  const showControls = controls.isVisible && !isLocked;

  return (
    <div
      className={`player-box ${showControls ? "" : "controls-hidden"} ${
        fullscreen.isVirtual ? "virtual-fullscreen" : ""
      } ${isLocked ? "player-locked" : ""}`}
      onClick={gestures.handleFrameClick}
      onDoubleClick={gestures.handleFrameDoubleClick}
      onKeyDown={(event) => handlePlayerKeyDown(event, { isTvBrowser })}
      onPointerDown={gestures.handlePointerDown}
      onPointerMove={isLocked ? undefined : revealControls}
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
      <SeekHints hint={gestures.seekHint} />

      {isLocked || controls.isVisible ? (
        <LockButton isLocked={isLocked} onToggle={toggleLock} />
      ) : null}

      {isLocked ? null : (
        <SideNavButtons
          hasNext={Boolean(nextVideo)}
          hasPrevious={Boolean(previousVideo)}
          onClick={gestures.handleSideNavClick}
          onDoubleClick={gestures.handleSideNavDoubleClick}
        />
      )}

      {engine.isPlaying ? null : <PlayerPoster videoId={video.videoId} />}

      {!isLocked && (!engine.isPlaying || controls.isVisible) ? (
        <BigPlayButton
          isPlaying={engine.isPlaying}
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
