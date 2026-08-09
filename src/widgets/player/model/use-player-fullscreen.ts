import { useEffect, useMemo, useRef, useState } from "react";
import { unlockScreenOrientation } from "@/shared/lib/platform";
import { FullscreenController } from "./fullscreen-controller";

/**
 * Fullscreen with two backends: the real Fullscreen API where it exists, and a
 * CSS-only "virtual" fullscreen for iOS. Entering is always an explicit
 * choice; rotating the device does not decide it for the viewer.
 */
export function usePlayerFullscreen({
  hostRef,
  onChange,
}: {
  hostRef: React.RefObject<HTMLDivElement | null>;
  onChange?: (isFullscreen: boolean) => void;
}) {
  const controller = useMemo(
    () => new FullscreenController(hostRef),
    [hostRef],
  );
  const [isNative, setIsNative] = useState(false);
  const [isVirtual, setIsVirtual] = useState(false);
  const isFullscreen = isNative || isVirtual;

  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onChangeRef.current?.(isFullscreen);
  }, [isFullscreen]);

  useEffect(() => {
    function handleFullscreenChange() {
      const isActive = controller.isNativeActive;
      setIsNative(isActive);

      if (isActive) {
        setIsVirtual(false);
        return;
      }

      // The browser's own UI (Android back gesture, Esc) closed fullscreen
      // out from under us — mirror that everywhere.
      unlockScreenOrientation();
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
  }, [controller]);

  // Virtual fullscreen covers the viewport with CSS, so the page underneath
  // must not scroll or rubber-band.
  useEffect(() => {
    if (!isVirtual) {
      return;
    }

    const { body, documentElement } = document;
    const previous = {
      bodyOverflow: body.style.overflow,
      htmlOverflow: documentElement.style.overflow,
      overscroll: body.style.overscrollBehavior,
      touchAction: body.style.touchAction,
    };

    body.style.overflow = "hidden";
    documentElement.style.overflow = "hidden";
    body.style.overscrollBehavior = "none";
    body.style.touchAction = "none";

    return () => {
      body.style.overflow = previous.bodyOverflow;
      documentElement.style.overflow = previous.htmlOverflow;
      body.style.overscrollBehavior = previous.overscroll;
      body.style.touchAction = previous.touchAction;
    };
  }, [isVirtual]);

  async function enter() {
    if (controller.supportsNative) {
      try {
        if (await controller.enterNative()) {
          setIsNative(true);
          setIsVirtual(false);
          return;
        }
      } catch {
        // Fall through to the CSS-driven fullscreen below.
      }
    }

    setIsNative(false);
    setIsVirtual(true);
  }

  async function exit() {
    await controller.exitNative();
    setIsNative(false);
    setIsVirtual(false);
  }

  async function toggle() {
    if (isFullscreen) {
      await exit();
      return;
    }

    await enter();
  }

  return { isFullscreen, isVirtual, enter, exit, toggle };
}

export type PlayerFullscreen = ReturnType<typeof usePlayerFullscreen>;
