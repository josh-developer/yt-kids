"use client";

import { useEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";
import { SEEK_STEP_SECONDS } from "@/shared/config/app-config";
import { TimerBag } from "@/shared/lib/timers";

const CLICK_SETTLE_MS = 220;
const SEEK_HINT_MS = 2000;
const SWIPE_DOWN_PX = 90;
const SWIPE_DRIFT_PX = 140;
const SWIPE_MAX_MS = 900;

export type SeekDirection = "previous" | "next";

/**
 * Touch and mouse behaviour over the video surface: single tap toggles the
 * controls, double tap seeks, and a downward swipe leaves fullscreen. Single
 * taps wait out {@link CLICK_SETTLE_MS} so a double tap never also toggles.
 */
export function usePlayerGestures({
  isLocked,
  isFullscreen,
  onToggleControls,
  onSeekBy,
  onExitFullscreen,
  onPrevious,
  onNext,
}: {
  isLocked: boolean;
  isFullscreen: boolean;
  onToggleControls: () => void;
  onSeekBy: (seconds: number) => void;
  onExitFullscreen: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const timers = useRef(new TimerBag());
  const swipeStart = useRef<{ x: number; y: number; time: number } | null>(null);
  const didSwipe = useRef(false);
  const [seekHint, setSeekHint] = useState<SeekDirection | null>(null);

  useEffect(() => {
    const bag = timers.current;
    return () => bag.clearAll();
  }, []);

  function flashSeekHint(seconds: number) {
    if (seconds === 0) {
      return;
    }

    setSeekHint(seconds < 0 ? "previous" : "next");
    timers.current.timeout("hint", () => setSeekHint(null), SEEK_HINT_MS);
  }

  function isControl(target: EventTarget | null) {
    return (
      target instanceof HTMLElement &&
      Boolean(target.closest("button, input, textarea"))
    );
  }

  function handleFrameClick(event: MouseEvent<HTMLDivElement>) {
    if (isLocked || isControl(event.target)) {
      return;
    }

    if (didSwipe.current) {
      didSwipe.current = false;
      return;
    }

    timers.current.timeout("frame-click", onToggleControls, CLICK_SETTLE_MS);
  }

  function handleFrameDoubleClick(event: MouseEvent<HTMLDivElement>) {
    if (isLocked || isControl(event.target)) {
      return;
    }

    timers.current.clear("frame-click");

    const rect = event.currentTarget.getBoundingClientRect();
    const isLeftSide = event.clientX - rect.left < rect.width / 2;
    onSeekBy(isLeftSide ? -SEEK_STEP_SECONDS : SEEK_STEP_SECONDS);
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (isControl(event.target) || isLocked || !isFullscreen) {
      swipeStart.current = null;
      return;
    }

    swipeStart.current = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
    };
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = swipeStart.current;
    swipeStart.current = null;

    if (isLocked || !start || !isFullscreen) {
      return;
    }

    const isSwipeDown =
      event.clientY - start.y > SWIPE_DOWN_PX &&
      Math.abs(event.clientX - start.x) < SWIPE_DRIFT_PX &&
      performance.now() - start.time < SWIPE_MAX_MS;

    if (!isSwipeDown) {
      return;
    }

    didSwipe.current = true;
    timers.current.clear("frame-click");
    onExitFullscreen();
  }

  function handlePointerCancel() {
    swipeStart.current = null;
  }

  function handleSideNavClick(direction: SeekDirection) {
    timers.current.timeout(
      "side-nav",
      direction === "previous" ? onPrevious : onNext,
      CLICK_SETTLE_MS,
    );
  }

  function handleSideNavDoubleClick(direction: SeekDirection) {
    timers.current.clear("side-nav");
    onSeekBy(direction === "previous" ? -SEEK_STEP_SECONDS : SEEK_STEP_SECONDS);
  }

  return {
    seekHint,
    flashSeekHint,
    handleFrameClick,
    handleFrameDoubleClick,
    handlePointerCancel,
    handlePointerDown,
    handlePointerUp,
    handleSideNavClick,
    handleSideNavDoubleClick,
  };
}
