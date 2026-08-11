import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { lockedEmbedUrl, warmYouTubeOrigins } from "@/shared/api/youtube";
import {
  PLAYER_BOOT_KICK_MS,
  PLAYER_SKELETON_MS,
  PLAYER_STARTED_FALLBACK_MS,
  PLAYER_UNREACHABLE_MS,
} from "@/shared/config/app-config";
import { createSessionStore } from "@/shared/lib/storage/key-value-store";
import { clamp, parseDurationText } from "@/shared/lib/time";
import { TimerBag } from "@/shared/lib/timers";
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
  // mobile browser accepts. A tap can rebuild it with sound below.
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
   * document with `loadVideoById`; this source changes only for hard reloads,
   * including the one explicit rebuild that grants sound.
   */
  const [frameSource, setFrameSource] = useState<FrameSource>(() => ({
    key: 0,
    videoId: video.videoId,
    startsMuted: true,
    startSeconds: cleanStartSeconds(startTime),
    shouldAutoplay: true,
  }));
  /**
   * The viewer has asked for sound at least once while this iframe stack has
   * been alive. Muting again is done with a command; it must not force every
   * future video back into a muted URL.
   */
  const [hasRequestedSound, setHasRequestedSound] = useState(false);
  const [playbackGeneration, setPlaybackGeneration] = useState(0);

  const embedStartsMuted = frameSource.startsMuted;
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
  const embedStartsMutedRef = useRef(embedStartsMuted);
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
    embedStartsMutedRef.current = embedStartsMuted;
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

  function publishTime(seconds: number) {
    callbacks.current.onTimeUpdate?.(seconds);
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
        if (autoStartAttemptsRef.current < AUTO_START_ATTEMPTS) {
          autoStartAttemptsRef.current += 1;
          if (
            isMutedRef.current ||
            volumeRef.current === 0 ||
            embedStartsMutedRef.current
          ) {
            player.mute();
          }
          player.play();
          if (embedStartsMutedRef.current && !isMutedRef.current) {
            setIsMuted(true);
          }
          return;
        }

        // Out of retries: the embed is reachable and simply will not start
        // itself, so hand it to the viewer.
        setIsPlaying(false);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
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

  /**
   * `unMute` is only safe when this runs inside a real user gesture. Autoplay
   * paths therefore never send it; an iframe born with `mute=0` keeps sound by
   * itself, while an iframe born muted must be rebuilt from the sound tap.
   */
  function sendPlay() {
    primeTelemetry();
    // Real on every other browser; a no-op on iOS, where `volume` is read-only
    // and loudness belongs to the hardware buttons.
    player.setVolume(volumeRef.current);
    player.play();

    if (isMutedRef.current || volumeRef.current === 0) {
      player.mute();
      return;
    }

    if (!embedStartsMutedRef.current) {
      // Loaded with `mute=0`, so it already has sound. An `unMute` here would
      // only hand WebKit something to reject.
      return;
    }

    // Muted by its own URL, and no command can lift that. Report the truth so
    // the overlay appears and the viewer's tap becomes a rebuild.
    setIsMuted(true);
  }

  /** Autoplay is racy right after load, so the play command is sent twice. */
  function schedulePlay() {
    sendPlay();
    timers.current.timeout("play", sendPlay, PLAY_RETRY_MS);
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

    // Telemetry can lag well past this or never arrive at all, especially on
    // iOS Safari. The play command above already went out, so stop hiding real
    // video behind the spinner and poster on its account.
    timers.current.timeout(
      "started-fallback",
      () => {
        setIsBooting(false);
        if (!hasStartedRef.current) {
          hasStartedRef.current = true;
          setHasStarted(true);
        }
      },
      PLAYER_STARTED_FALLBACK_MS,
    );
  }

  function loadVideoInCurrentDocument(targetVideo: Video, startSeconds: number) {
    player.setVolume(volumeRef.current);
    player.disableCaptions();
    if (
      isMutedRef.current ||
      volumeRef.current === 0 ||
      embedStartsMutedRef.current
    ) {
      player.mute();
    }
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
    schedulePlay();
  }

  /**
   * The only unmute that survives on iOS Safari.
   *
   * Every audio command reaches the embed by `postMessage`, and user activation
   * does not cross a document boundary: the command runs inside the
   * youtube-nocookie document with no gesture behind it, so WebKit refuses to
   * clear `muted`.
   *
   * What WebKit does honour is an embed that comes up unmuted on its own. So
   * build a new iframe with `mute=0`, from inside the tap that asked for sound,
   * and resume where the video had already reached.
   */
  function reloadWithSound() {
    const currentVideo = videoRef.current;
    const atSeconds = cleanStartSeconds(clock.get());
    setHasRequestedSound(true);
    setIsMuted(false);
    wantsPlaybackRef.current = true;
    setIsPlaying(true);
    setFrameSource((source) => ({
      key: source.key + 1,
      videoId: currentVideo.videoId,
      startsMuted: false,
      startSeconds: atSeconds,
      shouldAutoplay: true,
    }));
  }

  /**
   * Lifts the mute the right way for whichever embed is on screen: a command if
   * this one came up unmuted and has already been allowed to make noise, a
   * rebuild if it was born muted.
   */
  function giveSound() {
    setIsMuted(false);

    if (embedStartsMutedRef.current) {
      reloadWithSound();
      return;
    }

    player.unMute();
  }

  function toggleMute() {
    if (!isMuted) {
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
    const shouldStartMuted =
      !hasRequestedSound || isMutedRef.current || volumeRef.current === 0;

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
