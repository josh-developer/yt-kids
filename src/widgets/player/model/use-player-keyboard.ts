import { useEffect, useRef } from "react";
import type { KeyboardEvent } from "react";
import { SEEK_STEP_SECONDS } from "@/shared/config/app-config";

const VOLUME_STEP = 10;

type PlayerKeyboardActions = {
  isLocked: boolean;
  isVirtualFullscreen: boolean;
  onSeekBy: (seconds: number) => void;
  onToggleFullscreen: () => void;
  onExitFullscreen: () => void;
  onPlayPause: () => void;
  onToggleMute: () => void;
  onVolumeBy: (delta: number) => void;
};

function isTypingTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    Boolean(target.closest("input, textarea, select, [contenteditable='true']"))
  );
}

/**
 * Page-level shortcuts (seek, `f`, Escape) plus the D-pad handler the TV
 * layout attaches to the focused player box.
 */
export function usePlayerKeyboard(actions: PlayerKeyboardActions) {
  const actionsRef = useRef(actions);

  useEffect(() => {
    actionsRef.current = actions;
  });

  useEffect(() => {
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      const current = actionsRef.current;
      if (current.isLocked || isTypingTarget(event.target)) {
        return;
      }

      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "MediaRewind") {
        event.preventDefault();
        current.onSeekBy(-SEEK_STEP_SECONDS);
        return;
      }

      if (event.key === "ArrowRight" || event.key === "MediaFastForward") {
        event.preventDefault();
        current.onSeekBy(SEEK_STEP_SECONDS);
        return;
      }

      if (event.key.toLowerCase() === "f") {
        event.preventDefault();
        current.onToggleFullscreen();
        return;
      }

      if (event.key.toLowerCase() === "m") {
        event.preventDefault();
        current.onToggleMute();
        return;
      }

      if (event.key === "Escape" && current.isVirtualFullscreen) {
        event.preventDefault();
        current.onExitFullscreen();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  /** Attached to the player box; TV remotes send arrows and media keys here. */
  return function handlePlayerKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    { isTvBrowser }: { isTvBrowser: boolean },
  ) {
    const current = actionsRef.current;
    if (current.isLocked) {
      return;
    }

    if (event.target !== event.currentTarget && isTypingTarget(event.target)) {
      return;
    }

    if (event.key === "Escape" && current.isVirtualFullscreen) {
      event.preventDefault();
      current.onExitFullscreen();
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "MediaRewind") {
      event.preventDefault();
      current.onSeekBy(-SEEK_STEP_SECONDS);
      return;
    }

    if (event.key === "ArrowRight" || event.key === "MediaFastForward") {
      event.preventDefault();
      current.onSeekBy(SEEK_STEP_SECONDS);
      return;
    }

    if (!isTvBrowser) {
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      current.onVolumeBy(VOLUME_STEP);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      current.onVolumeBy(-VOLUME_STEP);
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
      current.onPlayPause();
    }
  };
}
