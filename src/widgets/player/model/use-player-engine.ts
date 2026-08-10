import { useEffect, useMemo, useRef, useState } from "react";
import { lockedEmbedUrl, warmYouTubeOrigins } from "@/shared/api/youtube";
import {
  PLAYER_BOOT_KICK_MS,
  PLAYER_SKELETON_MS,
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
const END_TOLERANCE_SECONDS = 0.25;

/** What went wrong, in the two flavours the viewer can act on. */
export type PlayerFailure = "blocked" | "unreachable";

/** Names one iframe instance: a new video or a reload is a different embed. */
function embedToken(videoId: string, reloadKey: number) {
  return `${videoId}:${reloadKey}`;
}

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
  // The play head lives here rather than in state; see PlaybackClock.
  const clock = useMemo(() => new PlaybackClock(), []);

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
  const [durationSeconds, setDurationSeconds] = useState(() =>
    parseDurationText(video.duration),
  );
  const [reloadKey, setReloadKey] = useState(0);
  const [shouldAutoplay, setShouldAutoplay] = useState(true);
  /**
   * The viewer has asked for sound at least once this session. Until they have,
   * every embed is built with `mute=1`: muted autoplay is the only autoplay iOS
   * Safari allows, and an unmuted `autoplay=1` there simply never starts.
   *
   * Never cleared. Muting again is done with a `mute` command, which every
   * browser honours — it is only the unmuting direction that WebKit guards — so
   * a mute must not drag the embed back to being built muted, or the viewer
   * would pay a reload for every tap of the button.
   */
  const [hasRequestedSound, setHasRequestedSound] = useState(false);
  /**
   * Set by the tap that asks for sound: which embed is being rebuilt unmuted,
   * and how far in the video had already got. Tagged with the embed it belongs
   * to so a position captured on one video cannot follow the viewer to the next.
   */
  const [soundResume, setSoundResume] = useState<{
    token: string;
    atSeconds: number;
  } | null>(null);

  const durationRef = useRef(0);
  const publishedDurationRef = useRef(0);
  const isRestartingRef = useRef(false);
  const isPlayingRef = useRef(true);
  const hasStartedRef = useRef(false);
  const hasTelemetryRef = useRef(false);
  const hasFrameLoadedRef = useRef(false);
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

  /**
   * The live embed, described by the two things its URL encodes about audio.
   *
   * Both are derived from state that only moves when a reload is intended, so
   * the URL settles when the iframe is created and then holds still — a `src`
   * that changes under a live iframe re-navigates it mid-playback. Keeping
   * `startsMuted` readable for the embed's whole life is also what lets
   * `sendPlay` and `giveSound` tell "muted because the URL said so" apart from
   * "muted because the viewer asked".
   */
  const embedStartsMuted = !hasRequestedSound;
  const embedStartSeconds =
    soundResume?.token === embedToken(video.videoId, reloadKey)
      ? soundResume.atSeconds
      : 0;
  const embedUrl = lockedEmbedUrl(video.videoId, {
    shouldAutoplay,
    shouldStartMuted: embedStartsMuted,
    startSeconds: embedStartSeconds,
  });

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
    // Zero for a new video or a retry; mid-video only when this reload exists
    // to rebuild the embed with sound, where restarting would be a punishment
    // for having asked for it.
    clock.set(embedStartSeconds);
    durationRef.current = fallbackDuration;
    publishedDurationRef.current = fallbackDuration;
    hasStartedRef.current = false;
    hasTelemetryRef.current = false;
    hasFrameLoadedRef.current = false;
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
        // would be worse than saying nothing: the progress bar keeps its own
        // time and everything except live position stays usable.
        if (hasFrameLoadedRef.current) {
          return;
        }

        setIsBooting(false);
        setIsPlaying(false);
        setFailure("unreachable");
      },
      PLAYER_UNREACHABLE_MS,
    );

    const frame = window.requestAnimationFrame(() => {
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
        clock.set(telemetry.currentTime);
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
  }, [clock, iframeRef, player]);

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
        clock.set(
          Math.min(
            durationRef.current || Number.MAX_SAFE_INTEGER,
            clock.get() + PROGRESS_TICK_MS / 1000,
          ),
        );

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
    // `reloadKey` and the video id are here because switching embeds clears
    // every timer; without them the ticker would stay dead for a video that
    // was already playing when the switch happened.
  }, [clock, isPlaying, player, reloadKey, video.id]);

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
   *
   * "Answers" means telemetry arrived. It used to mean `durationRef > 0`,
   * which is seeded from the catalog's duration string and is therefore
   * already true on the first tick — so the handshake was attempted about
   * twice and then abandoned. An embed that booted slowly, which is most
   * likely right after pressing next, never got its channel opened: playback
   * ran with sound while the app heard nothing back from it.
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
   * `allowUnmute` must only be true when this runs synchronously inside a real
   * user gesture (a click/tap handler). WebKit's rule for iOS Safari is
   * stricter than "playback is running": unmuting a video from script outside a
   * user gesture doesn't just get ignored, it pauses the video outright.
   * Autoplay (frame load, boot timer, up-next countdown) never has a gesture
   * behind it.
   *
   * This used to send `mute()` on every call, including the ones that then
   * immediately tried to unmute — so a boot re-muted whatever the viewer had
   * won, up to four times per video (`schedulePlay` sends twice, and both
   * `handleFrameLoad` and the boot timer call it). The embed's URL now carries
   * the mute state instead, and this only speaks up when the two disagree.
   */
  function sendPlay() {
    primeTelemetry();
    // Real on every other browser; a no-op on iOS, where `volume` is read-only
    // and loudness belongs to the hardware buttons.
    player.setVolume(volume);
    player.play();

    if (isMuted || volume === 0) {
      player.mute();
      return;
    }

    if (!embedStartsMuted) {
      // Loaded with `mute=0`, so it already has sound. An `unMute` here would
      // only hand WebKit something to reject.
      return;
    }

    // Muted by its own URL, and no command can lift that — see
    // `reloadWithSound`. Report the truth so the overlay appears and the
    // viewer's tap becomes a rebuild that actually produces sound.
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
    player.setVolume(volume);
    if (shouldAutoplay && isPlayingRef.current) {
      schedulePlay();
    }
  }

  function handleFrameLoad() {
    hasFrameLoadedRef.current = true;
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

  /**
   * The only unmute that survives on iOS Safari.
   *
   * Every audio command reaches the embed by `postMessage`, and user activation
   * does not cross a document boundary: the command runs inside the
   * youtube-nocookie document with no gesture behind it, so WebKit refuses to
   * clear `muted`. Nothing reports the refusal, so the app used to believe it
   * had sound while the video stayed silent — and raising the volume could not
   * rescue it either, because `HTMLMediaElement.volume` is read-only on iOS.
   *
   * What WebKit does honour is an embed that comes up unmuted on its own. So
   * build a new iframe with `mute=0`, from inside the tap that asked for sound —
   * that is what keeps the navigation privileged — and resume where the video
   * had already reached.
   */
  function reloadWithSound() {
    setSoundResume({
      token: embedToken(video.videoId, reloadKey + 1),
      atSeconds: Math.floor(clock.get()),
    });
    setHasRequestedSound(true);
    setShouldAutoplay(true);
    setIsPlaying(true);
    setReloadKey((key) => key + 1);
  }

  /**
   * Lifts the mute the right way for whichever embed is on screen: a command if
   * this one came up unmuted and has already been allowed to make noise, a
   * rebuild if it was born muted.
   */
  function giveSound() {
    setIsMuted(false);

    if (embedStartsMuted) {
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

  /** Repeat-one: reloading the iframe is the only reliable replay. */
  function restart() {
    if (isRestartingRef.current) {
      return;
    }

    isRestartingRef.current = true;
    clock.set(0);
    setShouldAutoplay(true);
    setIsPlaying(true);
    setReloadKey((key) => key + 1);
  }

  /** After a blocked or unreachable embed: throw the iframe away and retry. */
  function retry() {
    clock.set(0);
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
    clock,
    isBooting,
    hasStarted,
    areCaptionsEnabled,
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
    toggleCaptions,
    toggleMute,
  };
}

export type PlayerEngine = ReturnType<typeof usePlayerEngine>;
