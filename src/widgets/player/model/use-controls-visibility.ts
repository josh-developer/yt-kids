import { useEffect, useRef, useState } from "react";
import { TimerBag } from "@/shared/lib/timers";

const AUTO_HIDE_MS = 3000;

/** Controls fade out while a video plays and come back on any interaction. */
export function useControlsVisibility() {
  const [isVisible, setIsVisible] = useState(true);
  const timers = useRef(new TimerBag());

  useEffect(() => {
    const bag = timers.current;
    return () => bag.clearAll();
  }, []);

  function scheduleHide() {
    timers.current.timeout("hide", () => setIsVisible(false), AUTO_HIDE_MS);
  }

  function hide() {
    timers.current.clear("hide");
    setIsVisible(false);
  }

  function show({ autoHide }: { autoHide: boolean }) {
    timers.current.clear("hide");
    setIsVisible(true);
    if (autoHide) {
      scheduleHide();
    }
  }

  return { isVisible, show, hide, scheduleHide };
}

export type ControlsVisibility = ReturnType<typeof useControlsVisibility>;
