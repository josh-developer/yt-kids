import { useEffect, useRef, useState } from "react";
import { TimerBag } from "@/shared/lib/timers";

const AUTO_HIDE_MS = 3000;

/**
 * Controls fade out while a video plays and come back on any interaction.
 *
 * A deliberate interaction — a tap on the video, a control button, a key —
 * *pins* them: they then stay up until the viewer asks for them to go away,
 * because controls vanishing under a finger that just pressed something reads
 * as the app ignoring the press. Only passive reveals (a mouse drifting over
 * the video, playback starting on its own) auto-hide.
 */
export function useControlsVisibility() {
  const [isVisible, setIsVisible] = useState(true);
  const isPinned = useRef(false);
  const timers = useRef(new TimerBag());

  useEffect(() => {
    const bag = timers.current;
    return () => bag.clearAll();
  }, []);

  function scheduleHide() {
    if (isPinned.current) {
      return;
    }

    timers.current.timeout("hide", () => setIsVisible(false), AUTO_HIDE_MS);
  }

  function hide() {
    timers.current.clear("hide");
    isPinned.current = false;
    setIsVisible(false);
  }

  function show({ autoHide }: { autoHide: boolean }) {
    timers.current.clear("hide");
    setIsVisible(true);
    if (autoHide) {
      scheduleHide();
    }
  }

  /** Show and keep showing, until `hide` is called. */
  function pin() {
    timers.current.clear("hide");
    isPinned.current = true;
    setIsVisible(true);
  }

  return { isVisible, show, hide, pin, scheduleHide };
}

export type ControlsVisibility = ReturnType<typeof useControlsVisibility>;
