"use client";

import {
  Lock,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Repeat1,
  SkipBack,
  SkipForward,
  Unlock,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import type { CopyText } from "../../lib/copy";
import { isIosLikeBrowser, unlockScreenOrientation } from "../../lib/platform";
import type { FullscreenHostDocument, FullscreenHostElement, Video } from "../../lib/types";
import {
  formatTimestamp,
  fetchYouTubeMetadata,
  isTrustedYouTubeMessageOrigin,
  lockedEmbedUrl,
  parseDurationText,
  thumbnailUrl,
} from "../../lib/youtube";

export function SafeYouTubePlayer({
  copy,
  isTvBrowser,
  nextVideo,
  previousVideo,
  video,
  onDurationResolved,
  onFullscreenChange,
  onNextVideo,
  onPreviousVideo,
}: {
  copy: CopyText;
  isTvBrowser: boolean;
  nextVideo: Video | null;
  previousVideo: Video | null;
  video: Video;
  onDurationResolved: (video: Video, seconds: number) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  onNextVideo: () => void;
  onPreviousVideo: () => void;
}) {
  const playerBoxRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false);
  const [isVirtualFullscreen, setIsVirtualFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isRepeatOne, setIsRepeatOne] = useState(false);
  const [playerReloadKey, setPlayerReloadKey] = useState(0);
  const [shouldAutoplay, setShouldAutoplay] = useState(true);
  const [activeSeekHint, setActiveSeekHint] = useState<"previous" | "next" | null>(
    null,
  );
  const [volume, setVolumeState] = useState(80);
  const [currentTime, setCurrentTime] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(() =>
    parseDurationText(video.duration),
  );
  const fullscreenSwipeRef = useRef<{
    x: number;
    y: number;
    time: number;
  } | null>(null);
  const didSwipeToExitRef = useRef(false);
  const isDraggingProgressRef = useRef(false);
  const playTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const frameClickTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );
  const sideNavClickTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );
  const seekHintsTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );
  const telemetryTimerRef = useRef<ReturnType<typeof window.setInterval> | null>(
    null,
  );
  const controlsTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );
  const progressTimerRef = useRef<ReturnType<typeof window.setInterval> | null>(
    null,
  );
  const currentTimeRef = useRef(0);
  const durationRef = useRef(0);
  const handleVideoEndedRef = useRef<() => void>(() => {});
  const isRestartingRepeatRef = useRef(false);
  const repeatOneRef = useRef(false);
  const videoRef = useRef(video);
  const nextVideoRef = useRef(nextVideo);
  const onDurationResolvedRef = useRef(onDurationResolved);
  const onNextVideoRef = useRef(onNextVideo);
  const publishedDurationRef = useRef(0);
  const seekRelativeRef = useRef<(seconds: number) => void>(() => {});
  const toggleFullscreenRef = useRef<() => void>(() => {});
  const exitFullscreenRef = useRef<() => void>(() => {});
  const isVirtualFullscreenRef = useRef(false);
  const isLockedRef = useRef(false);
  const isFullscreen = isNativeFullscreen || isVirtualFullscreen;
  const isFullscreenRef = useRef(false);
  const fullscreenTriggerRef = useRef<"auto" | "manual" | null>(null);
  const onFullscreenChangeRef = useRef(onFullscreenChange);
  const shouldStartMuted = shouldAutoplay;

  useEffect(() => {
    if (!isTvBrowser) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      playerBoxRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isTvBrowser]);

  useEffect(() => {
    handleVideoEndedRef.current = () => {
      if (repeatOneRef.current) {
        if (isRestartingRepeatRef.current) {
          return;
        }

        isRestartingRepeatRef.current = true;
        currentTimeRef.current = 0;
        setCurrentTime(0);
        setShouldAutoplay(true);
        setIsPlaying(true);
        setControlsVisible(true);
        setPlayerReloadKey((key) => key + 1);
        scheduleControlsHide();
        return;
      }

      if (nextVideoRef.current) {
        onNextVideoRef.current();
      }
    };
  });

  useEffect(() => {
    repeatOneRef.current = isRepeatOne;
  }, [isRepeatOne]);

  useEffect(() => {
    videoRef.current = video;
  }, [video]);

  useEffect(() => {
    const fallbackDurationSeconds = parseDurationText(video.duration);
    currentTimeRef.current = 0;
    durationRef.current = fallbackDurationSeconds;
    publishedDurationRef.current = fallbackDurationSeconds;
    isRestartingRepeatRef.current = false;
    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current);
    }
    if (seekHintsTimerRef.current) {
      window.clearTimeout(seekHintsTimerRef.current);
    }
    if (telemetryTimerRef.current) {
      window.clearInterval(telemetryTimerRef.current);
      telemetryTimerRef.current = null;
    }

    const frame = window.requestAnimationFrame(() => {
      setCurrentTime(0);
      setDurationSeconds(fallbackDurationSeconds);
      setShouldAutoplay(true);
      setIsPlaying(true);
      setIsMuted(false);
      setControlsVisible(true);
      setActiveSeekHint(null);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [video.duration, video.id]);

  useEffect(() => {
    let isCancelled = false;

    async function loadVideoDuration() {
      const metadata = await fetchYouTubeMetadata(
        `https://www.youtube.com/watch?v=${video.videoId}`,
      );
      const seconds = metadata.durationSeconds ?? 0;
      if (isCancelled || seconds <= 0) {
        return;
      }

      durationRef.current = seconds;
      publishedDurationRef.current = seconds;
      setDurationSeconds(seconds);
      onDurationResolvedRef.current(videoRef.current, seconds);
    }

    void loadVideoDuration();

    return () => {
      isCancelled = true;
    };
  }, [video.id, video.videoId]);

  useEffect(() => {
    nextVideoRef.current = nextVideo;
    onDurationResolvedRef.current = onDurationResolved;
    onNextVideoRef.current = onNextVideo;
    onFullscreenChangeRef.current = onFullscreenChange;
  }, [nextVideo, onDurationResolved, onFullscreenChange, onNextVideo]);

  useEffect(() => {
    onFullscreenChangeRef.current?.(isFullscreen);
  }, [isFullscreen]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!isTrustedYouTubeMessageOrigin(event.origin)) {
        return;
      }

      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      let payload: {
        event?: string;
        info?:
          | number
          | {
              currentTime?: number;
              duration?: number;
              playerState?: number;
            };
      };
      try {
        payload =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }

      if (
        payload.event !== "infoDelivery" &&
        payload.event !== "initialDelivery" &&
        payload.event !== "onStateChange"
      ) {
        return;
      }

      const info = payload.info;
      if (typeof info === "object" && typeof info.currentTime === "number") {
        currentTimeRef.current = info.currentTime;
        setCurrentTime(info.currentTime);
      }

      if (typeof info === "object" && typeof info.duration === "number" && info.duration > 0) {
        durationRef.current = info.duration;
        setDurationSeconds(info.duration);
        if (Math.abs(info.duration - publishedDurationRef.current) >= 1) {
          publishedDurationRef.current = info.duration;
          onDurationResolvedRef.current(videoRef.current, info.duration);
        }
      }

      const playerState =
        typeof info === "number"
          ? info
          : typeof info === "object"
            ? info.playerState
            : undefined;
      if (typeof playerState !== "number") {
        return;
      }

      if (playerState === 0) {
        handleVideoEndedRef.current();
        return;
      }

      if (playerState === 1) {
        setIsPlaying(true);
        setControlsVisible(true);
        scheduleControlsHide();
      } else {
        setIsPlaying(false);
        setControlsVisible(true);
        if (controlsTimerRef.current) {
          window.clearTimeout(controlsTimerRef.current);
        }
      }

    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    return () => {
      if (playTimerRef.current) {
        window.clearTimeout(playTimerRef.current);
      }
      if (frameClickTimerRef.current) {
        window.clearTimeout(frameClickTimerRef.current);
      }
      if (sideNavClickTimerRef.current) {
        window.clearTimeout(sideNavClickTimerRef.current);
      }
      if (seekHintsTimerRef.current) {
        window.clearTimeout(seekHintsTimerRef.current);
      }
      if (telemetryTimerRef.current) {
        window.clearInterval(telemetryTimerRef.current);
      }
      if (controlsTimerRef.current) {
        window.clearTimeout(controlsTimerRef.current);
      }
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    currentTimeRef.current = currentTime;
  }, [currentTime]);

  useEffect(() => {
    durationRef.current = durationSeconds;
  }, [durationSeconds]);

  useEffect(() => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }

    if (!isPlaying) {
      return;
    }

    progressTimerRef.current = window.setInterval(() => {
      sendPlayerCommand("getCurrentTime");
      sendPlayerCommand("getDuration");
      currentTimeRef.current = Math.min(
        durationRef.current || Number.MAX_SAFE_INTEGER,
        currentTimeRef.current + 0.75,
      );
      setCurrentTime(currentTimeRef.current);
      if (
        durationRef.current > 0 &&
        currentTimeRef.current >= durationRef.current - 0.25
      ) {
        handleVideoEndedRef.current();
      }
    }, 750);

    return () => {
      if (progressTimerRef.current) {
        window.clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }
    };
  }, [isPlaying]);

  useEffect(() => {
    function handleFullscreenChange() {
      const fullscreenDocument = document as FullscreenHostDocument;
      const isCurrentNativeFullscreen =
        document.fullscreenElement === playerBoxRef.current ||
        fullscreenDocument.webkitFullscreenElement === playerBoxRef.current;
      setIsNativeFullscreen(isCurrentNativeFullscreen);
      if (isCurrentNativeFullscreen) {
        setIsVirtualFullscreen(false);
      } else {
        // The browser's own UI (Android back gesture, etc.) closed native
        // fullscreen out from under us — mirror that everywhere.
        fullscreenTriggerRef.current = null;
        unlockScreenOrientation();
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
    };
  }, []);

  useEffect(() => {
    // Auto-enter fullscreen when the device physically rotates to
    // landscape while watching, and auto-exit that specific auto-entered
    // fullscreen when it rotates back. A manually-entered fullscreen (via
    // the button) is left exactly as the user chose it — portrait stays
    // portrait until they exit it themselves.
    const query = window.matchMedia("(orientation: landscape)");

    function handleOrientationChange(event: MediaQueryListEvent) {
      if (event.matches) {
        if (!isFullscreenRef.current) {
          void enterFullscreen("auto");
        }
        return;
      }

      if (
        isFullscreenRef.current &&
        fullscreenTriggerRef.current === "auto"
      ) {
        void exitFullscreenAll();
      }
    }

    query.addEventListener("change", handleOrientationChange);
    return () => query.removeEventListener("change", handleOrientationChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isVirtualFullscreen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    const previousTouchAction = document.body.style.touchAction;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.body.style.touchAction = "none";

    return () => {
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      document.body.style.touchAction = previousTouchAction;
    };
  }, [isVirtualFullscreen]);

  function scheduleControlsHide() {
    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current);
    }

    controlsTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 3000);
  }

  function revealControls() {
    setControlsVisible(true);
    if (isPlaying) {
      scheduleControlsHide();
    }
  }

  function hideControls() {
    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }
    setControlsVisible(false);
  }

  function sendPlayerCommand(
    func: string,
    args: Array<boolean | number | string> = [],
  ) {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "*",
    );
  }

  function primePlayerTelemetry() {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "listening", id: `kidtube-${videoRef.current.id}` }),
      "*",
    );
    sendPlayerCommand("getDuration");
    sendPlayerCommand("getCurrentTime");
  }

  function startTelemetryPolling() {
    if (telemetryTimerRef.current) {
      window.clearInterval(telemetryTimerRef.current);
    }

    let attempts = 0;
    primePlayerTelemetry();
    telemetryTimerRef.current = window.setInterval(() => {
      attempts += 1;
      primePlayerTelemetry();
      if (attempts >= 12 || durationRef.current > 0) {
        if (telemetryTimerRef.current) {
          window.clearInterval(telemetryTimerRef.current);
          telemetryTimerRef.current = null;
        }
      }
    }, 650);
  }

  function sendPlayCommand(forceMuted = false) {
    const shouldKeepMuted = forceMuted;
    primePlayerTelemetry();
    sendPlayerCommand("setVolume", [volume]);
    if (shouldKeepMuted || isMuted || volume === 0) {
      sendPlayerCommand("mute");
      if (shouldKeepMuted) {
        setIsMuted(true);
      }
    } else {
      sendPlayerCommand("unMute");
    }
    sendPlayerCommand("playVideo");
  }

  function schedulePlayCommand(forceMuted = false) {
    if (playTimerRef.current) {
      window.clearTimeout(playTimerRef.current);
    }

    sendPlayCommand(forceMuted);
    playTimerRef.current = window.setTimeout(() => {
      sendPlayCommand(forceMuted);
    }, 350);
  }

  function playPause() {
    revealControls();
    if (isPlaying) {
      sendPlayerCommand("pauseVideo");
      setIsPlaying(false);
      setControlsVisible(true);
      if (controlsTimerRef.current) {
        window.clearTimeout(controlsTimerRef.current);
      }
    } else {
      setShouldAutoplay(true);
      setIsPlaying(true);
      schedulePlayCommand(false);
      scheduleControlsHide();
    }
  }

  function toggleMute() {
    revealControls();
    sendPlayerCommand(isMuted ? "unMute" : "mute");
    setIsMuted((muted) => !muted);
  }

  function setVolume(nextVolume: number) {
    revealControls();
    const clampedVolume = Math.max(0, Math.min(100, nextVolume));
    setVolumeState(clampedVolume);
    sendPlayerCommand("setVolume", [clampedVolume]);
    if (clampedVolume === 0) {
      sendPlayerCommand("mute");
      setIsMuted(true);
    } else {
      sendPlayerCommand("unMute");
      setIsMuted(false);
    }
  }

  function seekRelative(seconds: number) {
    revealControls();
    if (seconds !== 0) {
      flashSeekHint(seconds < 0 ? "previous" : "next");
    }
    const duration = durationRef.current;
    const upperBound = duration > 0 ? duration : Number.MAX_SAFE_INTEGER;
    const targetTime = Math.max(
      0,
      Math.min(upperBound, currentTimeRef.current + seconds),
    );
    currentTimeRef.current = targetTime;
    setCurrentTime(targetTime);
    sendPlayerCommand("seekTo", [targetTime, true]);
  }

  function flashSeekHint(direction: "previous" | "next") {
    if (seekHintsTimerRef.current) {
      window.clearTimeout(seekHintsTimerRef.current);
    }

    setActiveSeekHint(direction);
    seekHintsTimerRef.current = window.setTimeout(() => {
      setActiveSeekHint(null);
      seekHintsTimerRef.current = null;
    }, 2000);
  }

  seekRelativeRef.current = seekRelative;
  isVirtualFullscreenRef.current = isVirtualFullscreen;
  isLockedRef.current = isLocked;
  isFullscreenRef.current = isFullscreen;

  useEffect(() => {
    function handleWindowKeyDown(event: globalThis.KeyboardEvent) {
      const target = event.target;
      if (isLockedRef.current) {
        return;
      }

      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        (target instanceof HTMLElement &&
          target.closest("input, textarea, select, [contenteditable='true']"))
      ) {
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "MediaRewind") {
        event.preventDefault();
        seekRelativeRef.current(-15);
        return;
      }

      if (event.key === "ArrowRight" || event.key === "MediaFastForward") {
        event.preventDefault();
        seekRelativeRef.current(15);
        return;
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        toggleFullscreenRef.current();
        return;
      }

      if (event.key === "Escape" && isVirtualFullscreenRef.current) {
        event.preventDefault();
        exitFullscreenRef.current();
      }
    }

    window.addEventListener("keydown", handleWindowKeyDown);
    return () => window.removeEventListener("keydown", handleWindowKeyDown);
  }, []);

  function seekToProgressPosition(
    clientX: number,
    progressElement: HTMLButtonElement,
  ) {
    revealControls();
    if (durationRef.current <= 0) {
      return;
    }

    const rect = progressElement.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (clientX - rect.left) / rect.width),
    );
    const targetTime = durationRef.current * ratio;
    currentTimeRef.current = targetTime;
    setCurrentTime(targetTime);
    sendPlayerCommand("seekTo", [targetTime, true]);
  }

  function handleProgressPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (durationRef.current <= 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    isDraggingProgressRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    seekToProgressPosition(event.clientX, event.currentTarget);
  }

  function handleProgressPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!isDraggingProgressRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    seekToProgressPosition(event.clientX, event.currentTarget);
  }

  function stopProgressDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!isDraggingProgressRef.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    isDraggingProgressRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    scheduleControlsHide();
  }

  function seekFromDoubleClick(event: MouseEvent<HTMLDivElement>) {
    if (isLocked) {
      return;
    }

    const target = event.target;
    if (target instanceof HTMLElement && target.closest("button, input")) {
      return;
    }

    if (frameClickTimerRef.current) {
      window.clearTimeout(frameClickTimerRef.current);
      frameClickTimerRef.current = null;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const isLeftSide = event.clientX - rect.left < rect.width / 2;
    seekRelative(isLeftSide ? -15 : 15);
  }

  function handlePlayerFrameClick(event: MouseEvent<HTMLDivElement>) {
    if (isLocked) {
      return;
    }

    if (didSwipeToExitRef.current) {
      didSwipeToExitRef.current = false;
      return;
    }

    const target = event.target;
    if (target instanceof HTMLElement && target.closest("button, input")) {
      return;
    }

    if (frameClickTimerRef.current) {
      window.clearTimeout(frameClickTimerRef.current);
    }

    frameClickTimerRef.current = window.setTimeout(() => {
      frameClickTimerRef.current = null;
      if (controlsVisible) {
        hideControls();
      } else {
        revealControls();
      }
    }, 220);
  }

  function handlePlayerPointerDown(event: PointerEvent<HTMLDivElement>) {
    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target.closest("button, input, textarea")
    ) {
      fullscreenSwipeRef.current = null;
      return;
    }

    if (isLocked || !isFullscreen) {
      fullscreenSwipeRef.current = null;
      return;
    }

    fullscreenSwipeRef.current = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
    };
  }

  function handlePlayerPointerUp(event: PointerEvent<HTMLDivElement>) {
    const swipeStart = fullscreenSwipeRef.current;
    fullscreenSwipeRef.current = null;
    if (isLocked || !swipeStart || !isFullscreen) {
      return;
    }

    const deltaX = event.clientX - swipeStart.x;
    const deltaY = event.clientY - swipeStart.y;
    const elapsed = performance.now() - swipeStart.time;
    const isSwipeDown =
      deltaY > 90 && Math.abs(deltaX) < 140 && elapsed < 900;

    if (!isSwipeDown) {
      return;
    }

    didSwipeToExitRef.current = true;
    if (frameClickTimerRef.current) {
      window.clearTimeout(frameClickTimerRef.current);
      frameClickTimerRef.current = null;
    }
    void exitFullscreenAll();
  }

  function clearSideNavClickTimer() {
    if (sideNavClickTimerRef.current) {
      window.clearTimeout(sideNavClickTimerRef.current);
      sideNavClickTimerRef.current = null;
    }
  }

  function handleSideNavClick(direction: "previous" | "next") {
    revealControls();
    clearSideNavClickTimer();
    sideNavClickTimerRef.current = window.setTimeout(() => {
      sideNavClickTimerRef.current = null;
      if (direction === "previous") {
        if (previousVideo) {
          onPreviousVideo();
        }
        return;
      }

      if (nextVideo) {
        onNextVideo();
      }
    }, 220);
  }

  function handleSideNavDoubleClick(direction: "previous" | "next") {
    clearSideNavClickTimer();
    seekRelative(direction === "previous" ? -15 : 15);
  }

  function handlePlayerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (isLocked) {
      return;
    }

    const target = event.target;
    if (
      target instanceof HTMLElement &&
      target !== event.currentTarget &&
      target.closest("button, input, textarea")
    ) {
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "MediaRewind") {
      event.preventDefault();
      seekRelative(-15);
      return;
    }

    if (event.key === "ArrowRight" || event.key === "MediaFastForward") {
      event.preventDefault();
      seekRelative(15);
      return;
    }

    if (!isTvBrowser) {
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setVolume(volume + 10);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setVolume(volume - 10);
      return;
    }

    if (
      event.key === " " ||
      event.key === "Enter" ||
      event.key === "MediaPlayPause" ||
      event.key === "Play" ||
      event.key === "Pause"
    ) {
      event.preventDefault();
      playPause();
    }
  }

  function enterVirtualFullscreen() {
    setIsNativeFullscreen(false);
    setIsVirtualFullscreen(true);
    setControlsVisible(true);
    window.setTimeout(() => {
      playerBoxRef.current?.focus({ preventScroll: true });
      scheduleControlsHide();
    }, 0);
  }

  async function exitNativeFullscreen() {
    const fullscreenDocument = document as FullscreenHostDocument;
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen();
      return;
    }

    if (
      fullscreenDocument.webkitFullscreenElement &&
      fullscreenDocument.webkitExitFullscreen
    ) {
      await fullscreenDocument.webkitExitFullscreen();
    }
  }

  async function requestNativeFullscreen() {
    const playerElement = playerBoxRef.current as FullscreenHostElement | null;
    if (!playerElement) {
      return false;
    }

    if (playerElement.requestFullscreen) {
      await playerElement.requestFullscreen({ navigationUI: "hide" });
      return true;
    }

    if (playerElement.webkitRequestFullscreen) {
      await playerElement.webkitRequestFullscreen();
      return true;
    }

    return false;
  }

  async function enterFullscreen(trigger: "auto" | "manual") {
    fullscreenTriggerRef.current = trigger;

    if (!isIosLikeBrowser() && playerBoxRef.current) {
      try {
        const didEnterNativeFullscreen = await requestNativeFullscreen();
        if (didEnterNativeFullscreen) {
          setIsNativeFullscreen(true);
          setIsVirtualFullscreen(false);
          return;
        }
      } catch {
        // Fall through to the virtual (CSS-driven) fullscreen below.
      }
    }

    enterVirtualFullscreen();
  }

  async function exitFullscreenAll() {
    const fullscreenDocument = document as FullscreenHostDocument;
    if (
      document.fullscreenElement ||
      fullscreenDocument.webkitFullscreenElement
    ) {
      await exitNativeFullscreen();
    }

    fullscreenTriggerRef.current = null;
    setIsNativeFullscreen(false);
    setIsVirtualFullscreen(false);
    unlockScreenOrientation();
    setControlsVisible(true);
  }

  async function toggleFullscreen() {
    revealControls();
    if (isFullscreen) {
      await exitFullscreenAll();
      return;
    }

    await enterFullscreen("manual");
  }

  function exitFallbackFullscreenOnEscape(event: KeyboardEvent<HTMLDivElement>) {
    if (isLocked) {
      return;
    }

    if (event.key === "Escape" && isVirtualFullscreen) {
      event.preventDefault();
      void exitFullscreenAll();
      revealControls();
    } else {
      handlePlayerKeyDown(event);
    }
  }

  toggleFullscreenRef.current = () => {
    void toggleFullscreen();
  };
  exitFullscreenRef.current = () => {
    void exitFullscreenAll();
  };

  function toggleRepeatOne() {
    revealControls();
    setIsRepeatOne((current) => !current);
  }

  function toggleLock() {
    if (isLocked) {
      setIsLocked(false);
      revealControls();
      return;
    }

    setIsLocked(true);
    hideControls();
  }

  return (
    <div
      className={`player-box ${controlsVisible && !isLocked ? "" : "controls-hidden"} ${
        isVirtualFullscreen ? "virtual-fullscreen" : ""
      } ${isLocked ? "player-locked" : ""}`}
      onClick={handlePlayerFrameClick}
      onDoubleClick={seekFromDoubleClick}
      onKeyDown={exitFallbackFullscreenOnEscape}
      onPointerDown={handlePlayerPointerDown}
      onPointerMove={isLocked ? undefined : revealControls}
      onPointerUp={handlePlayerPointerUp}
      onPointerCancel={() => {
        fullscreenSwipeRef.current = null;
      }}
      role={isTvBrowser ? "region" : undefined}
      onSelect={(event) => event.preventDefault()}
      onSelectCapture={(event) => event.preventDefault()}
      tabIndex={isTvBrowser ? 0 : undefined}
      aria-label={
        isTvBrowser
          ? copy.videoPlayerHelp
          : undefined
      }
      ref={playerBoxRef}
    >
      <iframe
        key={`${video.id}-${playerReloadKey}`}
        aria-hidden="true"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        allowFullScreen
        className="youtube-mount"
        onLoad={() => {
          isRestartingRepeatRef.current = false;
          startTelemetryPolling();
          sendPlayerCommand("setVolume", [volume]);
          if (shouldAutoplay) {
            schedulePlayCommand(false);
          }
        }}
        ref={iframeRef}
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        src={lockedEmbedUrl(video.videoId, shouldAutoplay, shouldStartMuted)}
        tabIndex={-1}
        title={copy.videoSurface(video.title)}
        onContextMenu={(event) => event.preventDefault()}
      />
      <div
        className={`youtube-title-cover ${controlsVisible ? "" : "hidden"}`}
        aria-hidden="true"
      />
      <div
        className={`seek-zones ${activeSeekHint ? `show-${activeSeekHint}` : ""}`}
        aria-hidden="true"
      >
        <span>-15</span>
        <span>+15</span>
      </div>
      {isLocked || controlsVisible ? (
        <button
          className="player-lock-button"
          onClick={(event) => {
            event.stopPropagation();
            toggleLock();
          }}
          onDoubleClick={(event) => event.stopPropagation()}
          type="button"
          aria-label={isLocked ? copy.unlockControls : copy.lockControls}
          aria-pressed={isLocked}
        >
          {isLocked ? <Lock size={24} /> : <Unlock size={24} />}
        </button>
      ) : null}
      {!isLocked ? (
        <div className="side-player-buttons" aria-label={copy.videoControls}>
          <button
            className={`side-player-button left ${previousVideo ? "" : "is-disabled"}`}
            onClick={(event) => {
              event.stopPropagation();
              handleSideNavClick("previous");
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleSideNavDoubleClick("previous");
            }}
            type="button"
            aria-disabled={!previousVideo}
            aria-label={copy.previousVideo}
          >
            <SkipBack size={24} fill="currentColor" />
          </button>
          <button
            className={`side-player-button right ${nextVideo ? "" : "is-disabled"}`}
            onClick={(event) => {
              event.stopPropagation();
              handleSideNavClick("next");
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleSideNavDoubleClick("next");
            }}
            type="button"
            aria-disabled={!nextVideo}
            aria-label={copy.nextVideo}
          >
            <SkipForward size={24} fill="currentColor" />
          </button>
        </div>
      ) : null}
      {!isPlaying ? (
        <div className="player-poster">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src={thumbnailUrl(video.videoId)} />
        </div>
      ) : null}
      {!isLocked && (!isPlaying || controlsVisible) ? (
        <button
          className="big-play-button"
          onClick={(event) => {
            event.stopPropagation();
            playPause();
          }}
          onDoubleClick={(event) => event.stopPropagation()}
          type="button"
          aria-label={isPlaying ? copy.pause : copy.playVideo}
        >
          {isPlaying ? (
            <Pause size={30} fill="currentColor" />
          ) : (
            <Play size={30} fill="currentColor" />
          )}
        </button>
      ) : null}
      {!isLocked ? (
        <div className="player-progress-wrap">
          <button
            className="player-progress"
            disabled={durationSeconds <= 0}
            onPointerCancel={stopProgressDrag}
            onPointerDown={handleProgressPointerDown}
            onPointerMove={handleProgressPointerMove}
            onPointerUp={stopProgressDrag}
            type="button"
            aria-label="Seek video"
          >
            <span
              className="player-progress-fill"
              style={{
                width:
                  durationSeconds > 0
                    ? `${Math.min(100, (currentTime / durationSeconds) * 100)}%`
                    : "0%",
              }}
            />
          </button>
          <span className="player-time">
            {formatTimestamp(currentTime)} /{" "}
            {durationSeconds > 0 ? formatTimestamp(durationSeconds) : "--:--"}
          </span>
        </div>
      ) : null}
      {!isLocked ? (
      <div className="safe-player-controls" aria-label={copy.videoControls}>
        <div className="footer-transport-controls">
          <button
            className="player-control-button"
            disabled={!previousVideo}
            onClick={onPreviousVideo}
            type="button"
            aria-label={copy.previousVideo}
          >
            <SkipBack size={16} fill="currentColor" />
          </button>
          <button
            className="player-control-button primary"
            onClick={playPause}
            type="button"
            aria-label={isPlaying ? copy.pause : copy.playVideo}
          >
            {isPlaying ? (
              <Pause size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" />
            )}
          </button>
          <button
            className="player-control-button"
            disabled={!nextVideo}
            onClick={onNextVideo}
            type="button"
            aria-label={copy.nextVideo}
          >
            <SkipForward size={16} fill="currentColor" />
          </button>
          <span className="control-divider" />
        </div>
        <button
          className="player-control-button"
          onClick={toggleMute}
          type="button"
          aria-label={isMuted ? copy.unmute : copy.mute}
        >
          {isMuted || volume === 0 ? (
            <VolumeX size={16} />
          ) : volume < 50 ? (
            <Volume1 size={16} />
          ) : (
            <Volume2 size={16} />
          )}
        </button>
        <button
          className="player-control-button volume-step"
          onClick={() => setVolume(volume - 10)}
          type="button"
          aria-label={copy.volumeDown}
        >
          -
        </button>
        <span className="volume-meter" aria-label={copy.volume(volume)}>
          <span style={{ width: `${volume}%` }} />
        </span>
        <button
          className="player-control-button volume-step"
          onClick={() => setVolume(volume + 10)}
          type="button"
          aria-label={copy.volumeUp}
        >
          +
        </button>
        <button
          className={`player-control-button repeat-button ${isRepeatOne ? "active" : ""}`}
          onClick={toggleRepeatOne}
          type="button"
          aria-label={
            isRepeatOne ? copy.repeatOneEnabled : copy.repeatOneDisabled
          }
          aria-pressed={isRepeatOne}
        >
          <Repeat1 size={18} />
        </button>
        <button
          className="player-control-button fullscreen-button"
          onClick={toggleFullscreen}
          type="button"
          aria-label={isFullscreen ? copy.exitFullScreen : copy.fullScreen}
        >
          {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
      ) : null}
    </div>
  );
}
