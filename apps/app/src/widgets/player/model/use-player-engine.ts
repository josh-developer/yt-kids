import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { lockedEmbedUrl, warmYouTubeOrigins } from "@/shared/api/youtube";
import {
  DEFAULT_VOLUME,
  PLAYER_BOOT_KICK_MS,
  PLAYER_SKELETON_MS,
  PLAYER_STARTED_FALLBACK_MS,
  PLAYER_UNREACHABLE_MS,
} from "@/shared/config/app-config";
import { createSessionStore } from "@/shared/lib/storage/key-value-store";
import { clamp, parseDurationText } from "@/shared/lib/time";
import { TimerBag } from "@/shared/lib/timers";
import { useScreenWakeLock } from "@/shared/lib/use-screen-wake-lock";
import type { Video } from "@/entities/video";
import { PlaybackClock } from "./playback-clock";
import { PlayerController } from "./player-controller";
import { PlayerPreferences } from "./player-preferences";
import { PLAYER_STATE, readPlayerTelemetry } from "./player-messages";

const PROGRESS_TICK_MS = 750;
const TELEMETRY_TICK_MS = 650;
const TELEMETRY_ATTEMPTS = 12;
const PLAY_RETRY_MS = 350;
/** How many times a still-unstarted embed is asked to play once it answers. */
const AUTO_START_ATTEMPTS = 4;
/** A first iframe can ignore `playVideo`; `loadVideoById` is the stronger nudge. */
const LOAD_KICK_ATTEMPTS = 1;
const END_TOLERANCE_SECONDS = 0.25;

/** What went wrong, in the two flavours the viewer can act on. */
export type PlayerFailure = "blocked" | "unreachable";

type FrameSource = {
  key: number;
  videoId: string;
  startsMuted: boolean;
  startSeconds: number;
  shouldAutoplay: boolean;
};

function cleanStartSeconds(seconds: number | undefined) {
  return Number.isFinite(seconds) && seconds && seconds > 0
    ? Math.floor(seconds)
    : 0;
}

/**
 * Playback state for one living YouTube document: sends commands to the embed,
 * folds the telemetry that comes back into React state, and keeps the progress
 * bar moving between telemetry packets.
 */
export function usePlayerEngine({
  iframeRef,
  video,
  startTime = 0,
  onDurationResolved,
  onEnded,
  onPlayingChange,
  onTimeUpdate,
}: {
  iframeRef: RefObject<HTMLIFrameElement | null>;
  video: Video;
  startTime?: number;
  onDurationResolved: (video: Video, seconds: number) => void;
  onEnded: () => void;
  onPlayingChange: (isPlaying: boolean) => void;
  onTimeUpdate?: (currentSeconds: number) => void;
}) {
  const player = useMemo(() => new PlayerController(iframeRef), [iframeRef]);
  const preferences = useMemo(
    () => new PlayerPreferences(createSessionStore()),
    [],
  );
  const timers = useRef(new TimerBag());
  // The play head lives here rather than in state; see PlaybackClock.
  const clock = useMemo(() => new PlaybackClock(), []);

  const [isPlaying, setIsPlaying] = useState(true);
  // The first frame is always born muted; it is the only autoplay that every
  // mobile browser accepts. A tap later lifts that mute with an iframe command.
  const [isMuted, setIsMuted] = useState(true);
  const [volume, setVolumeState] = useState(() => preferences.readVolume());
  // Covers the embed while it boots, instead of showing YouTube's own chrome.
  const [isBooting, setIsBooting] = useState(true);
  // Playback has produced at least one frame, so the poster is no longer the
  // right thing to show when the video pauses.
  const [hasStarted, setHasStarted] = useState(false);
  const [failure, setFailure] = useState<PlayerFailure | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(() =>
    parseDurationText(video.duration),
  );
  /**
   * The iframe's URL is state, not a derivation from `video`.
   *
   * Moving through the playlist must not change this object. A new URL means a
   * new YouTube document, and on iOS that loses the audio unlock the viewer
   * just paid for with a tap. Ordinary video changes are sent to the living
   * document with `loadVideoById`; this source changes only for hard reloads
   * such as retrying after a blocked or unreachable embed.
   */
  const [frameSource, setFrameSource] = useState<FrameSource>(() => ({
    key: 0,
    videoId: video.videoId,
    startsMuted: true,
    startSeconds: cleanStartSeconds(startTime),
    shouldAutoplay: true,
  }));
  const [playbackGeneration, setPlaybackGeneration] = useState(0);

  const embedUrl = lockedEmbedUrl(frameSource.videoId, {
    shouldAutoplay: frameSource.shouldAutoplay,
    shouldStartMuted: frameSource.startsMuted,
    startSeconds: frameSource.startSeconds,
  });

  const durationRef = useRef(0);
  const publishedDurationRef = useRef(0);
  const isRestartingRef = useRef(false);
  const isPlayingRef = useRef(true);
  const isMutedRef = useRef(isMuted);
  const volumeRef = useRef(volume);
  const ignoreMutedTelemetryUntilRef = useRef(0);
  const hasStartedRef = useRef(false);
  const hasTelemetryRef = useRef(false);
  const hasFrameLoadedRef = useRef(false);
  // Distinct from `hasStarted`, which is optimistic and gets forced true on a
  // timer: this one is only ever set by the embed reporting `playing`. It is
  // what decides whether the embed still needs to be reachable by a tap.
  const [hasConfirmedPlaying, setHasConfirmedPlaying] = useState(false);
  const hasConfirmedPlayingRef = useRef(false);
  // "We are trying to start this video and the viewer has not taken over."
  // Cleared by a deliberate pause so retries never fight the viewer.
  const wantsPlaybackRef = useRef(true);
  const autoStartAttemptsRef = useRef(0);
  const loadKickAttemptsRef = useRef(0);
  const videoRef = useRef(video);
  const callbacks = useRef({
    onDurationResolved,
    onEnded,
    onPlayingChange,
    onTimeUpdate,
  });

  useEffect(() => {
    videoRef.current = video;
    isPlayingRef.current = isPlaying;
    isMutedRef.current = isMuted;
    volumeRef.current = volume;
    callbacks.current = {
      onDurationResolved,
      onEnded,
      onPlayingChange,
      onTimeUpdate,
    };
  });

  useEffect(() => {
    preferences.saveMuted(isMuted);
  }, [isMuted, preferences]);

  useEffect(() => {
    preferences.saveVolume(volume);
  }, [preferences, volume]);

  // The embed's own connections cost as much as its first frame; open them as
  // soon as a player exists rather than when the src is set.
  useEffect(warmYouTubeOrigins, []);

  useEffect(() => {
    durationRef.current = durationSeconds;
  }, [durationSeconds]);

  useEffect(() => {
    onPlayingChange(isPlaying);
    // Reported to the shell; re-running on callback identity would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  useScreenWakeLock(isPlaying && hasConfirmedPlaying && failure === null);

  function publishTime(seconds: number) {
    callbacks.current.onTimeUpdate?.(seconds);
  }

  function showPlaybackSurface() {
    timers.current.clear("skeleton");
    timers.current.clear("started-fallback");
    setIsBooting(false);

    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      setHasStarted(true);
    }
  }

  function revealManualPlay() {
    showPlaybackSurface();

    setIsPlaying(false);
  }

  function tryAutoplayKick() {
    showPlaybackSurface();
    setIsPlaying(true);

    if (autoStartAttemptsRef.current >= AUTO_START_ATTEMPTS) {
      return false;
    }

    autoStartAttemptsRef.current += 1;
    sendPlay({
      includeLoadKick: loadKickAttemptsRef.current < LOAD_KICK_ATTEMPTS,
    });
    scheduleStartedFallback();
    return true;
  }

  function resetPlayback({
    fallbackVideo,
    frameHasLoaded,
    startSeconds,
  }: {
    fallbackVideo: Video;
    frameHasLoaded: boolean;
    startSeconds: number;
  }) {
    const fallbackDuration = parseDurationText(fallbackVideo.duration);

    clock.set(startSeconds);
    publishTime(startSeconds);
    durationRef.current = fallbackDuration;
    publishedDurationRef.current = fallbackDuration;
    hasStartedRef.current = false;
    hasTelemetryRef.current = false;
    hasFrameLoadedRef.current = frameHasLoaded;
    hasConfirmedPlayingRef.current = false;
    wantsPlaybackRef.current = true;
    autoStartAttemptsRef.current = 0;
    loadKickAttemptsRef.current = 0;
    isRestartingRef.current = false;
    timers.current.clearAll();
    timers.current.timeout(
      "skeleton",
      () => setIsBooting(false),
      PLAYER_SKELETON_MS,
    );
    timers.current.timeout(
      "unreachable",
      () => {
        if (hasTelemetryRef.current) {
          return;
        }

        // The embed's document loaded, so YouTube is plainly reachable; what
        // was lost is the message channel, and the video is most likely
        // playing. Accusing the network over a video the viewer can hear
        // would be worse than saying nothing.
        if (hasFrameLoadedRef.current) {
          return;
        }

        setIsBooting(false);
        setIsPlaying(false);
        setFailure("unreachable");
      },
      PLAYER_UNREACHABLE_MS,
    );

    setDurationSeconds(fallbackDuration);
    setIsPlaying(true);
    setIsBooting(true);
    setHasStarted(false);
    setHasConfirmedPlaying(false);
    setFailure(null);
    setPlaybackGeneration((generation) => generation + 1);
  }

  /**
   * Reset the app-facing state for a new logical video. If the iframe URL was
   * seeded with that same video, the browser is loading it for us. Otherwise
   * the document stays alive and receives a `loadVideoById` command.
   */
  useEffect(() => {
    const isFrameUrlVideo = frameSource.videoId === video.videoId;
    const startSeconds = isFrameUrlVideo
      ? frameSource.startSeconds
      : cleanStartSeconds(startTime);
    const bag = timers.current;

    const frame = window.requestAnimationFrame(() => {
      resetPlayback({
        fallbackVideo: video,
        frameHasLoaded: !isFrameUrlVideo,
        startSeconds,
      });

      if (isFrameUrlVideo) {
        timers.current.timeout("boot", bootEmbed, PLAYER_BOOT_KICK_MS);
        return;
      }

      loadVideoInCurrentDocument(video, startSeconds);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      bag.clearAll();
    };
    // Keyed by the embed document and the logical video. Duration backfills
    // must not restart a video already playing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameSource.key, video.id]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const telemetry = readPlayerTelemetry(event, iframeRef.current);
      if (!telemetry) {
        return;
      }

      if (telemetry.videoId && telemetry.videoId !== videoRef.current.videoId) {
        return;
      }

      // Anything at all from the embed proves the network reaches YouTube.
      hasTelemetryRef.current = true;
      timers.current.clear("unreachable");

      if (typeof telemetry.errorCode === "number") {
        timers.current.clearAll();
        setIsBooting(false);
        setIsPlaying(false);
        setFailure("blocked");
        return;
      }

      if (typeof telemetry.currentTime === "number") {
        clock.set(telemetry.currentTime);
        publishTime(telemetry.currentTime);
      }

      if (typeof telemetry.muted === "boolean") {
        const isFreshUnmute =
          telemetry.muted &&
          performance.now() < ignoreMutedTelemetryUntilRef.current;
        if (!isFreshUnmute) {
          setIsMuted(telemetry.muted || volumeRef.current === 0);
        }
      }

      // The only source of a real duration: the embed reports it within a
      // second of starting, so there is nothing to ask the network for.
      if (typeof telemetry.duration === "number" && telemetry.duration > 0) {
        durationRef.current = telemetry.duration;
        setDurationSeconds(telemetry.duration);
        if (
          Math.abs(telemetry.duration - publishedDurationRef.current) >= 1
        ) {
          publishedDurationRef.current = telemetry.duration;
          callbacks.current.onDurationResolved(
            videoRef.current,
            telemetry.duration,
          );
        }
      }

      if (typeof telemetry.playerState !== "number") {
        return;
      }

      if (telemetry.playerState === PLAYER_STATE.ended) {
        callbacks.current.onEnded();
        return;
      }

      // Buffering, cued and unstarted are not pauses. Treating them as one is
      // what made the poster and the big play button flash mid-playback.
      if (telemetry.playerState === PLAYER_STATE.playing) {
        if (!hasStartedRef.current) {
          player.disableCaptions();
        }

        hasStartedRef.current = true;
        hasConfirmedPlayingRef.current = true;
        setHasStarted(true);
        setHasConfirmedPlaying(true);
        setIsPlaying(true);
        setFailure(null);
        timers.current.clear("skeleton");
        timers.current.clear("started-fallback");
        setIsBooting(false);
        return;
      }

      if (telemetry.playerState === PLAYER_STATE.paused) {
        if (!hasConfirmedPlayingRef.current) {
          if (wantsPlaybackRef.current && tryAutoplayKick()) {
            return;
          }

          revealManualPlay();
          return;
        }

        setIsPlaying(false);
        return;
      }

      // Still sitting at "unstarted"/"cued" after we asked it to play. Before
      // the first frame those states mean the play command may have landed too
      // early, so ask again now that telemetry proves the document is awake.
      if (
        !hasConfirmedPlayingRef.current &&
        wantsPlaybackRef.current &&
        (telemetry.playerState === PLAYER_STATE.unstarted ||
          telemetry.playerState === PLAYER_STATE.cued)
      ) {
        if (tryAutoplayKick()) {
          return;
        }

        // Out of retries: the embed is reachable and simply will not start
        // itself, so hand it to the viewer.
        revealManualPlay();
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
    // The listener reads live refs; helper identities would only resubscribe it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clock, iframeRef, player]);

  // Between telemetry packets, advance the clock ourselves so the progress bar
  // stays smooth, and detect the end even if `onStateChange` never arrives.
  useEffect(() => {
    if (!isPlaying) {
      timers.current.clear("progress");
      return;
    }

    timers.current.interval(
      "progress",
      () => {
        player.requestProgress();
        const nextSeconds = Math.min(
          durationRef.current || Number.MAX_SAFE_INTEGER,
          clock.get() + PROGRESS_TICK_MS / 1000,
        );
        clock.set(nextSeconds);
        publishTime(nextSeconds);

        if (
          durationRef.current > 0 &&
          clock.get() >= durationRef.current - END_TOLERANCE_SECONDS
        ) {
          callbacks.current.onEnded();
        }
      },
      PROGRESS_TICK_MS,
    );

    const bag = timers.current;
    return () => bag.clear("progress");
  }, [clock, isPlaying, playbackGeneration, player]);

  useEffect(() => {
    const bag = timers.current;
    return () => bag.clearAll();
  }, []);

  function primeTelemetry() {
    player.listen(`kidtube-${videoRef.current.id}`);
    player.requestProgress();
  }

  /**
   * The embed ignores commands sent before its own scripts are ready, so the
   * `listening` handshake is re-sent until it answers.
   */
  function startTelemetryPolling() {
    let attempts = 0;
    primeTelemetry();
    timers.current.interval(
      "telemetry",
      () => {
        attempts += 1;
        primeTelemetry();
        if (attempts >= TELEMETRY_ATTEMPTS || hasTelemetryRef.current) {
          timers.current.clear("telemetry");
        }
      },
      TELEMETRY_TICK_MS,
    );
  }

  /** Sends the current play intent plus the current audio intent to YouTube. */
  function sendPlay({ includeLoadKick = false } = {}) {
    primeTelemetry();
    // Real on every other browser; a no-op on iOS, where `volume` is read-only
    // and loudness belongs to the hardware buttons.
    player.setVolume(volumeRef.current);

    if (isMutedRef.current || volumeRef.current === 0) {
      player.mute();
    } else {
      player.unMute();
    }

    if (includeLoadKick && loadKickAttemptsRef.current < LOAD_KICK_ATTEMPTS) {
      loadKickAttemptsRef.current += 1;
      player.loadVideoById(videoRef.current.videoId, clock.get());
      return;
    }

    player.play();
  }

  /** Autoplay is racy right after load, so the play command is sent twice. */
  function schedulePlay() {
    sendPlay();
    timers.current.timeout("play", sendPlay, PLAY_RETRY_MS);
  }

  function kickStartPlayback() {
    sendPlay({ includeLoadKick: true });
    timers.current.timeout(
      "play",
      () => sendPlay({ includeLoadKick: true }),
      PLAY_RETRY_MS,
    );
    scheduleStartedFallback();
  }

  function handleStartedFallback() {
    if (hasConfirmedPlayingRef.current) {
      setIsBooting(false);
      return;
    }

    if (wantsPlaybackRef.current && tryAutoplayKick()) {
      return;
    }

    revealManualPlay();
  }

  function scheduleStartedFallback() {
    timers.current.timeout(
      "started-fallback",
      handleStartedFallback,
      PLAYER_STARTED_FALLBACK_MS,
    );
  }

  /**
   * Open the telemetry channel and, if the viewer has not taken over yet, ask
   * for playback. Safe to run more than once: both halves are idempotent.
   */
  function bootEmbed() {
    isRestartingRef.current = false;
    startTelemetryPolling();
    player.setVolume(volumeRef.current);
    player.disableCaptions();
    if (wantsPlaybackRef.current && isPlayingRef.current) {
      schedulePlay();
    }

    // Telemetry can lag or fail to report `playing`, especially on iOS Safari.
    // If playback is not confirmed quickly, show the video surface and try the
    // stronger `loadVideoById` path before falling back to manual play.
    scheduleStartedFallback();
  }

  function loadVideoInCurrentDocument(targetVideo: Video, startSeconds: number) {
    player.setVolume(volumeRef.current);
    player.disableCaptions();
    if (isMutedRef.current || volumeRef.current === 0) {
      player.mute();
    } else {
      player.unMute();
    }
    loadKickAttemptsRef.current = LOAD_KICK_ATTEMPTS;
    player.loadVideoById(targetVideo.videoId, startSeconds);
    bootEmbed();
  }

  function handleFrameLoad() {
    hasFrameLoadedRef.current = true;
    bootEmbed();
  }

  function playPause() {
    if (isPlaying) {
      wantsPlaybackRef.current = false;
      player.pause();
      setIsPlaying(false);
      return;
    }

    wantsPlaybackRef.current = true;
    autoStartAttemptsRef.current = 0;
    setIsPlaying(true);
    if (hasConfirmedPlayingRef.current) {
      schedulePlay();
      return;
    }

    kickStartPlayback();
  }

  /** Lifts mute without rebuilding the iframe that has already buffered video. */
  function giveSound() {
    const nextVolume =
      volumeRef.current === 0 ? DEFAULT_VOLUME : volumeRef.current;
    if (nextVolume !== volumeRef.current) {
      volumeRef.current = nextVolume;
      setVolumeState(nextVolume);
    }

    setIsMuted(false);
    ignoreMutedTelemetryUntilRef.current = performance.now() + 1200;
    player.setVolume(nextVolume);
    player.unMute();
  }

  function toggleMute() {
    if (!isMuted) {
      ignoreMutedTelemetryUntilRef.current = 0;
      player.mute();
      setIsMuted(true);
      return;
    }

    giveSound();
  }

  function setVolume(nextVolume: number) {
    const clamped = clamp(nextVolume, 0, 100);
    setVolumeState(clamped);
    player.setVolume(clamped);

    if (clamped === 0) {
      ignoreMutedTelemetryUntilRef.current = 0;
      player.mute();
      setIsMuted(true);
      return;
    }

    giveSound();
  }

  function seekTo(seconds: number) {
    const upperBound =
      durationRef.current > 0 ? durationRef.current : Number.MAX_SAFE_INTEGER;
    const target = clamp(seconds, 0, upperBound);
    clock.set(target);
    publishTime(target);
    player.seekTo(target);
  }

  function seekBy(seconds: number) {
    seekTo(clock.get() + seconds);
  }

  function seekToRatio(ratio: number) {
    if (durationRef.current <= 0) {
      return;
    }

    seekTo(durationRef.current * clamp(ratio, 0, 1));
  }

  /** Repeat-one without losing the living document that owns the sound grant. */
  function restart() {
    if (isRestartingRef.current) {
      return;
    }

    const currentVideo = videoRef.current;
    isRestartingRef.current = true;
    resetPlayback({
      fallbackVideo: currentVideo,
      frameHasLoaded: true,
      startSeconds: 0,
    });
    loadVideoInCurrentDocument(currentVideo, 0);
  }

  /** After a blocked or unreachable embed: throw the iframe away and retry. */
  function retry() {
    const currentVideo = videoRef.current;
    const shouldStartMuted = isMutedRef.current || volumeRef.current === 0;

    setFrameSource((source) => ({
      key: source.key + 1,
      videoId: currentVideo.videoId,
      startsMuted: shouldStartMuted,
      startSeconds: 0,
      shouldAutoplay: true,
    }));
  }

  return {
    reloadKey: frameSource.key,
    clock,
    isBooting,
    hasStarted,
    hasConfirmedPlaying,
    failure,
    embedUrl,
    isPlaying,
    isMuted,
    volume,
    durationSeconds,
    handleFrameLoad,
    playPause,
    restart,
    retry,
    seekBy,
    seekToRatio,
    setVolume,
    toggleMute,
  };
}

export type PlayerEngine = ReturnType<typeof usePlayerEngine>;
