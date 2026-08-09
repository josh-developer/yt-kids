import { useEffect, useMemo, useRef, useState } from "react";
import {
  lockedEmbedUrl,
  warmYouTubeOrigins,
  watchUrl,
  youTubeApi,
} from "@/shared/api/youtube";
import {
  PLAYER_BOOT_KICK_MS,
  PLAYER_SKELETON_MS,
  PLAYER_UNREACHABLE_MS,
} from "@/shared/config/app-config";
import { createSessionStore } from "@/shared/lib/storage/key-value-store";
import { clamp, parseDurationText } from "@/shared/lib/time";
import { TimerBag } from "@/shared/lib/timers";
import type { Video } from "@/entities/video";
import { PlayerController } from "./player-controller";
import { PlayerPreferences } from "./player-preferences";
import { PLAYER_STATE, readPlayerTelemetry } from "./player-messages";

const PROGRESS_TICK_MS = 750;
const TELEMETRY_TICK_MS = 650;
const TELEMETRY_ATTEMPTS = 12;
const PLAY_RETRY_MS = 350;
const END_TOLERANCE_SECONDS = 0.25;

/** What went wrong, in the two flavours the viewer can act on. */
export type PlayerFailure = "blocked" | "unreachable";

/**
 * Playback state for one video: sends commands to the embed, folds the
 * telemetry that comes back into React state, and keeps the progress bar
 * moving between telemetry packets.
 */
export function usePlayerEngine({
  iframeRef,
  video,
  onDurationResolved,
  onEnded,
  onPlayingChange,
}: {
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  video: Video;
  onDurationResolved: (video: Video, seconds: number) => void;
  onEnded: () => void;
  onPlayingChange: (isPlaying: boolean) => void;
}) {
  const player = useMemo(() => new PlayerController(iframeRef), [iframeRef]);
  const preferences = useMemo(
    () => new PlayerPreferences(createSessionStore()),
    [],
  );
  const timers = useRef(new TimerBag());

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(() => preferences.readMuted());
  const [volume, setVolumeState] = useState(() => preferences.readVolume());
  const [areCaptionsEnabled, setAreCaptionsEnabled] = useState(() =>
    preferences.readCaptions(),
  );
  // Covers the embed while it boots, instead of showing YouTube's own chrome.
  const [isBooting, setIsBooting] = useState(true);
  // Playback has produced at least one frame, so the poster is no longer the
  // right thing to show when the video pauses.
  const [hasStarted, setHasStarted] = useState(false);
  const [failure, setFailure] = useState<PlayerFailure | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(() =>
    parseDurationText(video.duration),
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [shouldAutoplay, setShouldAutoplay] = useState(true);

  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const publishedDurationRef = useRef(0);
  const isRestartingRef = useRef(false);
  const isPlayingRef = useRef(true);
  const hasStartedRef = useRef(false);
  const hasTelemetryRef = useRef(false);
  const captionsRef = useRef(areCaptionsEnabled);
  const videoRef = useRef(video);
  const callbacks = useRef({ onDurationResolved, onEnded, onPlayingChange });

  useEffect(() => {
    videoRef.current = video;
    isPlayingRef.current = isPlaying;
    captionsRef.current = areCaptionsEnabled;
    callbacks.current = { onDurationResolved, onEnded, onPlayingChange };
  });

  useEffect(() => {
    preferences.saveMuted(isMuted);
  }, [isMuted, preferences]);

  useEffect(() => {
    preferences.saveVolume(volume);
  }, [preferences, volume]);

  useEffect(() => {
    preferences.saveCaptions(areCaptionsEnabled);
  }, [areCaptionsEnabled, preferences]);

  // The embed's own connections cost as much as its first frame; open them as
  // soon as a player exists rather than when the src is set.
  useEffect(warmYouTubeOrigins, []);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    durationRef.current = durationSeconds;
  }, [durationSeconds]);

  useEffect(() => {
    onPlayingChange(isPlaying);
    // Reported to the shell; re-running on callback identity would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying]);

  // Reset everything when the watched video changes, or when a retry reloads
  // the same one.
  useEffect(() => {
    const fallbackDuration = parseDurationText(video.duration);
    currentTimeRef.current = 0;
    durationRef.current = fallbackDuration;
    publishedDurationRef.current = fallbackDuration;
    hasStartedRef.current = false;
    hasTelemetryRef.current = false;
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

        setIsBooting(false);
        setIsPlaying(false);
        setFailure("unreachable");
      },
      PLAYER_UNREACHABLE_MS,
    );

    const frame = window.requestAnimationFrame(() => {
      setCurrentTime(0);
      setDurationSeconds(fallbackDuration);
      setShouldAutoplay(true);
      setIsPlaying(true);
      setIsBooting(true);
      setHasStarted(false);
      setFailure(null);
    });

    return () => window.cancelAnimationFrame(frame);
    // Keyed by the embed, not by `video.duration`: backfilling a duration must
    // not reset a video that is already playing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, video.id]);

  // The catalog duration is a display string; oEmbed knows the real length.
  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      const metadata = await youTubeApi.fetchMetadata(watchUrl(video.videoId));
      const seconds = metadata.durationSeconds ?? 0;
      if (isCancelled || seconds <= 0) {
        return;
      }

      durationRef.current = seconds;
      publishedDurationRef.current = seconds;
      setDurationSeconds(seconds);
      callbacks.current.onDurationResolved(videoRef.current, seconds);
    })();

    return () => {
      isCancelled = true;
    };
  }, [video.id, video.videoId]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const telemetry = readPlayerTelemetry(event, iframeRef.current);
      if (!telemetry) {
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
        currentTimeRef.current = telemetry.currentTime;
        setCurrentTime(telemetry.currentTime);
      }

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
          // A fresh embed starts with captions off; restore the viewer's choice.
          player.setCaptions(captionsRef.current);
        }

        hasStartedRef.current = true;
        setHasStarted(true);
        setIsPlaying(true);
        setFailure(null);
        timers.current.clear("skeleton");
        setIsBooting(false);
        return;
      }

      if (telemetry.playerState === PLAYER_STATE.paused) {
        setIsPlaying(false);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [iframeRef, player]);

  // Between telemetry packets, advance the clock ourselves so the progress bar
  // stays smooth — and detect the end even if `onStateChange` never arrives.
  useEffect(() => {
    if (!isPlaying) {
      timers.current.clear("progress");
      return;
    }

    timers.current.interval(
      "progress",
      () => {
        player.requestProgress();
        currentTimeRef.current = Math.min(
          durationRef.current || Number.MAX_SAFE_INTEGER,
          currentTimeRef.current + PROGRESS_TICK_MS / 1000,
        );
        setCurrentTime(currentTimeRef.current);

        if (
          durationRef.current > 0 &&
          currentTimeRef.current >= durationRef.current - END_TOLERANCE_SECONDS
        ) {
          callbacks.current.onEnded();
        }
      },
      PROGRESS_TICK_MS,
    );

    const bag = timers.current;
    return () => bag.clear("progress");
    // `reloadKey` and the video id are here because switching embeds clears
    // every timer; without them the ticker would stay dead for a video that
    // was already playing when the switch happened.
  }, [isPlaying, player, reloadKey, video.id]);

  useEffect(() => {
    const bag = timers.current;
    return () => bag.clearAll();
  }, []);

  function primeTelemetry() {
    player.listen(`kidtube-${videoRef.current.id}`);
    player.requestProgress();
  }

  /** The embed ignores early commands, so we re-ask until it answers. */
  function startTelemetryPolling() {
    let attempts = 0;
    primeTelemetry();
    timers.current.interval(
      "telemetry",
      () => {
        attempts += 1;
        primeTelemetry();
        if (attempts >= TELEMETRY_ATTEMPTS || durationRef.current > 0) {
          timers.current.clear("telemetry");
        }
      },
      TELEMETRY_TICK_MS,
    );
  }

  function sendPlay() {
    primeTelemetry();
    player.setVolume(volume);
    // Browsers only allow autoplay to start muted, and refuse a scripted
    // unmute until playback is actually running — so always start muted and
    // lift it immediately afterwards when the viewer wants sound.
    player.mute();
    player.play();
    if (!isMuted && volume > 0) {
      player.unMute();
    }
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
    player.setVolume(volume);
    if (shouldAutoplay && isPlayingRef.current) {
      schedulePlay();
    }
  }

  function handleFrameLoad() {
    bootEmbed();
  }

  function playPause() {
    if (isPlaying) {
      player.pause();
      setIsPlaying(false);
      return;
    }

    setShouldAutoplay(true);
    setIsPlaying(true);
    schedulePlay();
  }

  function toggleCaptions() {
    setAreCaptionsEnabled((areEnabled) => {
      player.setCaptions(!areEnabled);
      return !areEnabled;
    });
  }

  function toggleMute() {
    if (isMuted) {
      player.unMute();
    } else {
      player.mute();
    }
    setIsMuted((muted) => !muted);
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

    player.unMute();
    setIsMuted(false);
  }

  function seekTo(seconds: number) {
    const upperBound =
      durationRef.current > 0 ? durationRef.current : Number.MAX_SAFE_INTEGER;
    const target = clamp(seconds, 0, upperBound);
    currentTimeRef.current = target;
    setCurrentTime(target);
    player.seekTo(target);
  }

  function seekBy(seconds: number) {
    seekTo(currentTimeRef.current + seconds);
  }

  function seekToRatio(ratio: number) {
    if (durationRef.current <= 0) {
      return;
    }

    seekTo(durationRef.current * clamp(ratio, 0, 1));
  }

  /** Repeat-one: reloading the iframe is the only reliable replay. */
  function restart() {
    if (isRestartingRef.current) {
      return;
    }

    isRestartingRef.current = true;
    currentTimeRef.current = 0;
    setCurrentTime(0);
    setShouldAutoplay(true);
    setIsPlaying(true);
    setReloadKey((key) => key + 1);
  }

  /** After a blocked or unreachable embed: throw the iframe away and retry. */
  function retry() {
    currentTimeRef.current = 0;
    setCurrentTime(0);
    setFailure(null);
    setShouldAutoplay(true);
    setIsPlaying(true);
    setIsBooting(true);
    setReloadKey((key) => key + 1);
  }

  // A cross-origin iframe does not always fire `load` — TV browsers in
  // particular — so the embed is primed on a timer too, not only from `onLoad`.
  useEffect(() => {
    const bag = timers.current;
    bag.timeout("boot", bootEmbed, PLAYER_BOOT_KICK_MS);
    return () => bag.clear("boot");
    // `bootEmbed` is re-created every render; the embed identity is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, video.videoId]);

  return {
    reloadKey,
    isBooting,
    hasStarted,
    areCaptionsEnabled,
    failure,
    // Autoplay implies muted; `sendPlay` unmutes once playback is running.
    embedUrl: lockedEmbedUrl(video.videoId, shouldAutoplay, shouldAutoplay),
    isPlaying,
    isMuted,
    volume,
    currentTime,
    durationSeconds,
    handleFrameLoad,
    playPause,
    restart,
    retry,
    seekBy,
    seekToRatio,
    setVolume,
    toggleCaptions,
    toggleMute,
  };
}

export type PlayerEngine = ReturnType<typeof usePlayerEngine>;
