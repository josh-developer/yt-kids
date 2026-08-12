import { useCallback, useEffect, useRef, useState } from "react";
import type WebView from "react-native-webview";
import {
  parsePlayerMessage,
  playerCommands,
  PLAYER_STATE,
  SEEK_STEP,
} from "./player-bridge";

/** A finger has nowhere to hover, so give it a while before the controls fade. */
const AUTO_HIDE_MS = 5000;
/**
 * How long an unmuted start is given before the muted fallback is used. Long enough to
 * cover a slow network reaching the iframe API, short enough not to look broken.
 */
const SOUND_GRACE_MS = 3500;

export type PlayerStatus = "loading" | "playing" | "paused" | "ended" | "error";

/**
 * Everything the player knows about itself, and every way to ask it for something.
 *
 * The page owns playback; this owns what the app believes about it. Position and
 * duration arrive from the page's own clock rather than being asked for, and the status
 * comes from `onStateChange` — so the chrome draws what the player is doing, not what it
 * was last told to do.
 *
 * Two behaviours here are the ones worth reading twice. The controls hide themselves
 * while a video plays and stay put while it is paused, because there is nothing to be in
 * the way of. And a video that never starts with sound is reloaded muted exactly once:
 * the app would rather have a silent video than a still frame, and it unmutes the moment
 * playback is under way.
 */
export function usePlayer({ videoId }: { videoId: string }) {
  const webview = useRef<WebView | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const soundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * A callback ref rather than the ref object, because the ref never leaves this hook.
   * Handing `webview` to the surface component would put a ref inside the value every
   * caller reads, and the React Compiler is right to call reading that during render a
   * mistake — it would taint `status`, `position` and the rest along with it.
   */
  const attachWebView = useCallback((instance: WebView | null) => {
    webview.current = instance;
  }, []);

  const [status, setStatus] = useState<PlayerStatus>("loading");
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [isRepeatOne, setIsRepeatOne] = useState(false);
  const [areControlsVisible, setAreControlsVisible] = useState(true);
  /** Set only if an unmuted start was refused; see `SOUND_GRACE_MS`. */
  const [startsMuted, setStartsMuted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  /**
   * The web's control lock: with it on, the surface stops answering taps so a child
   * cannot pause or seek by touching the picture. The lock button itself keeps working,
   * and is the only control that stays visible.
   */
  const [isLocked, setIsLocked] = useState(false);

  const send = useCallback((script: string) => {
    webview.current?.injectJavaScript(script);
  }, []);

  const clearHideTimer = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  }, []);

  /** Visible now; gone after the idle window, but only while something is playing. */
  const showControls = useCallback(
    (autoHide: boolean) => {
      clearHideTimer();
      setAreControlsVisible(true);
      if (autoHide) {
        hideTimer.current = setTimeout(
          () => setAreControlsVisible(false),
          AUTO_HIDE_MS,
        );
      }
    },
    [clearHideTimer],
  );

  const hideControls = useCallback(() => {
    clearHideTimer();
    setAreControlsVisible(false);
  }, [clearHideTimer]);

  const isPlaying = status === "playing";

  const toggleControls = useCallback(() => {
    setAreControlsVisible((visible) => {
      clearHideTimer();
      if (visible) {
        return false;
      }

      if (isPlaying) {
        hideTimer.current = setTimeout(
          () => setAreControlsVisible(false),
          AUTO_HIDE_MS,
        );
      }

      return true;
    });
  }, [clearHideTimer, isPlaying]);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      send(playerCommands.pause());
      showControls(false);
      return;
    }

    send(playerCommands.play());
    showControls(true);
  }, [isPlaying, send, showControls]);

  const seekBy = useCallback(
    (seconds: number) => {
      send(playerCommands.seekBy(seconds));
      showControls(isPlaying);
    },
    [isPlaying, send, showControls],
  );

  const seekToFraction = useCallback(
    (fraction: number) => {
      if (duration <= 0) {
        return;
      }

      const seconds = Math.min(1, Math.max(0, fraction)) * duration;
      setPosition(seconds);
      send(playerCommands.seekTo(seconds));
      showControls(isPlaying);
    },
    [duration, isPlaying, send, showControls],
  );

  /** From the end card, and from the strip once a video has finished. */
  const replay = useCallback(() => {
    send(playerCommands.seekTo(0));
    send(playerCommands.play());
    showControls(true);
  }, [send, showControls]);

  const toggleMute = useCallback(() => {
    setIsMuted((current) => {
      const next = !current;
      send(next ? playerCommands.mute() : playerCommands.unmute());
      return next;
    });
    showControls(isPlaying);
  }, [isPlaying, send, showControls]);

  const toggleLock = useCallback(() => {
    setIsLocked((current) => !current);
  }, []);

  const toggleRepeatOne = useCallback(() => {
    setIsRepeatOne((current) => {
      const next = !current;
      send(playerCommands.setLoop(next));
      return next;
    });
  }, [send]);

  /**
   * A different video resets what is known about playback, during the render that first
   * sees it — React's own answer to "adjust state when a prop changes", and the reason
   * this is not an effect: an effect would paint the previous video's position and
   * duration once before correcting them.
   */
  const [loadedVideoId, setLoadedVideoId] = useState(videoId);
  if (videoId !== loadedVideoId) {
    setLoadedVideoId(videoId);
    setPosition(0);
    setDuration(0);
    setErrorCode(null);
    setStatus("loading");
    setAreControlsVisible(true);
  }

  /**
   * A new video on the page that is already up, rather than a new page. This is what
   * makes tapping a recommendation start playing immediately instead of loading the
   * iframe API again. On the first run the page is still starting with this video and
   * the command lands before there is a player to take it, which the page ignores.
   */
  useEffect(() => {
    send(playerCommands.load(videoId));
  }, [send, videoId]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }

      if (soundTimer.current) {
        clearTimeout(soundTimer.current);
      }
    };
  }, []);

  const handleMessage = useCallback(
    (raw: string) => {
      const message = parsePlayerMessage(raw);
      if (!message) {
        return;
      }

      if (message.type === "time") {
        setPosition(message.position);
        if (message.duration > 0) {
          setDuration(message.duration);
        }

        return;
      }

      if (message.type === "error") {
        // The code is the only thing that tells 101/150 (the owner blocks embedding)
        // apart from 2 (a bad id) and 5 (the player itself failed), and the screen shows
        // one message for all of them.
        if (__DEV__) {
          console.warn(`Player error ${message.code} for ${videoId}`);
        }

        setErrorCode(message.code);
        setStatus("error");
        showControls(false);
        return;
      }

      if (message.type === "ready") {
        // If sound was refused, the state never reaches playing and this fires.
        soundTimer.current = setTimeout(() => {
          setStartsMuted((current) => current || true);
        }, SOUND_GRACE_MS);
        return;
      }

      if (message.state === PLAYER_STATE.playing) {
        if (soundTimer.current) {
          clearTimeout(soundTimer.current);
          soundTimer.current = null;
        }

        // The muted fallback is undone the moment there is playback to unmute.
        if (startsMuted) {
          send(playerCommands.unmute());
        }

        setStatus("playing");
        showControls(true);
        return;
      }

      if (message.state === PLAYER_STATE.ended) {
        setStatus("ended");
        // No controls over the end card: it has its own two buttons, and the strip
        // underneath would only compete with them.
        hideControls();
        return;
      }

      if (message.state === PLAYER_STATE.paused) {
        setStatus("paused");
        showControls(false);
      }
    },
    [hideControls, send, showControls, startsMuted, videoId],
  );

  return {
    attachWebView,
    startsMuted,
    status,
    errorCode,
    position,
    duration,
    isPlaying,
    isRepeatOne,
    isMuted,
    isLocked,
    hasEnded: status === "ended",
    areControlsVisible,
    handleMessage,
    hideControls,
    toggleControls,
    togglePlayback,
    seekBy,
    seekToFraction,
    toggleRepeatOne,
    toggleMute,
    toggleLock,
    replay,
    seekStep: SEEK_STEP,
  };
}

export type Player = ReturnType<typeof usePlayer>;
