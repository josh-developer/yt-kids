import { useEffect, useRef, useState } from "react";
import { TimerBag } from "@/shared/lib/timers";

/** A mouse dismisses controls by leaving, so its idle window can be short. */
const POINTER_AUTO_HIDE_MS = 3000;
/** A finger has nowhere to leave to, so give it longer before they fade. */
export const TOUCH_AUTO_HIDE_MS = 5000;

/**
 * Controls fade out while a video plays and come back on any interaction.
 *
 * The timer restarts on every interaction rather than the controls being
 * pinned open, which is what keeps both halves of the behaviour true: they
 * never vanish out from under a finger that is still pressing things, and a
 * viewer who then stops touching the screen gets the video back.
 *
 * A paused video keeps its controls — callers pass `autoHide: false` — since
 * there is nothing playing for them to be in the way of.
 */
export function useControlsVisibility() {
  const [isVisible, setIsVisible] = useState(true);
  const isPinned = useRef(false);
  const timers = useRef(new TimerBag());

  useEffect(() => {
    const bag = timers.current;
    return () => bag.clearAll();
  }, []);

  function scheduleHide(delayMs = POINTER_AUTO_HIDE_MS) {
    if (isPinned.current) {
      return;
    }

    timers.current.timeout("hide", () => setIsVisible(false), delayMs);
  }

  function hide() {
    timers.current.clear("hide");
    isPinned.current = false;
    setIsVisible(false);
  }

  function show({
    autoHide,
    delayMs,
  }: {
    autoHide: boolean;
    delayMs?: number;
  }) {
    timers.current.clear("hide");
    // Showing is always the caller taking ownership, so it releases any pin.
    isPinned.current = false;
    setIsVisible(true);
    if (autoHide) {
      scheduleHide(delayMs);
    }
  }

  /** Show and keep showing, until something calls `show` or `hide`. */
  function pin() {
    timers.current.clear("hide");
    isPinned.current = true;
    setIsVisible(true);
  }

  return { isVisible, show, hide, pin, scheduleHide };
}

export type ControlsVisibility = ReturnType<typeof useControlsVisibility>;
