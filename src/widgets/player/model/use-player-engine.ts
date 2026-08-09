import { useEffect, useMemo, useRef, useState } from "react";
import { lockedEmbedUrl, youTubeApi, watchUrl } from "@/shared/api/youtube";
import { clamp, parseDurationText } from "@/shared/lib/time";
import { TimerBag } from "@/shared/lib/timers";
import type { Video } from "@/entities/video";
import { PlayerController } from "./player-controller";
import { PLAYER_STATE, readPlayerTelemetry } from "./player-messages";

const PROGRESS_TICK_MS = 750;
const TELEMETRY_TICK_MS = 650;
const TELEMETRY_ATTEMPTS = 12;
const PLAY_RETRY_MS = 350;
const END_TOLERANCE_SECONDS = 0.25;
const DEFAULT_VOLUME = 80;

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
  const timers = useRef(new TimerBag());

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolumeState] = useState(DEFAULT_VOLUME);
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
  const videoRef = useRef(video);
  const callbacks = useRef({ onDurationResolved, onEnded, onPlayingChange });

  useEffect(() => {
    videoRef.current = video;
    callbacks.current = { onDurationResolved, onEnded, onPlayingChange };
  });

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

  // Reset everything when the watched video changes.
  useEffect(() => {
    const fallbackDuration = parseDurationText(video.duration);
    currentTimeRef.current = 0;
    durationRef.current = fallbackDuration;
    publishedDurationRef.current = fallbackDuration;
    isRestartingRef.current = false;
    timers.current.clearAll();

    const frame = window.requestAnimationFrame(() => {
      setCurrentTime(0);
      setDurationSeconds(fallbackDuration);
      setShouldAutoplay(true);
      setIsPlaying(true);
      setIsMuted(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [video.duration, video.id]);

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

      setIsPlaying(telemetry.playerState === PLAYER_STATE.playing);
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [iframeRef]);

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
  }, [isPlaying, player]);

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
    if (isMuted || volume === 0) {
      player.mute();
    } else {
      player.unMute();
    }
    player.play();
  }

  /** Autoplay is racy right after load, so the play command is sent twice. */
  function schedulePlay() {
    sendPlay();
    timers.current.timeout("play", sendPlay, PLAY_RETRY_MS);
  }

  function handleFrameLoad() {
    isRestartingRef.current = false;
    startTelemetryPolling();
    player.setVolume(volume);
    if (shouldAutoplay) {
      schedulePlay();
    }
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

  return {
    reloadKey,
    // Autoplay only works muted; the play command unmutes right after.
    embedUrl: lockedEmbedUrl(video.videoId, shouldAutoplay, shouldAutoplay),
    isPlaying,
    isMuted,
    volume,
    currentTime,
    durationSeconds,
    handleFrameLoad,
    playPause,
    restart,
    seekBy,
    seekToRatio,
    setVolume,
    toggleMute,
  };
}

export type PlayerEngine = ReturnType<typeof usePlayerEngine>;
