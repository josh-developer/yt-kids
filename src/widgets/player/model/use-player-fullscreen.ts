import { useEffect, useMemo, useRef, useState } from "react";
import {
  lockLandscapeOrientation,
  supportsOrientationLock,
  unlockScreenOrientation,
} from "@/shared/lib/platform";
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
  const wasNativeRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onChangeRef.current?.(isFullscreen);
  }, [isFullscreen]);

  useEffect(() => {
    function syncWithDocument() {
      const isActive = controller.isNativeActive;
      setIsNative(isActive);

      if (isActive) {
        wasNativeRef.current = true;
        setIsVirtual(false);
        return;
      }

      if (!wasNativeRef.current) {
        return;
      }

      // The browser's own UI (Android back gesture, Esc) closed fullscreen
      // out from under us — mirror that everywhere.
      wasNativeRef.current = false;
      unlockScreenOrientation();
    }

    document.addEventListener("fullscreenchange", syncWithDocument);
    document.addEventListener("webkitfullscreenchange", syncWithDocument);
    // Some mobile browsers leave fullscreen on rotation or on a tab switch
    // without ever firing `fullscreenchange`; re-reading the document on those
    // events is what keeps the button and the layout from disagreeing.
    document.addEventListener("fullscreenerror", syncWithDocument);
    window.addEventListener("orientationchange", syncWithDocument);
    window.addEventListener("pageshow", syncWithDocument);

    return () => {
      document.removeEventListener("fullscreenchange", syncWithDocument);
      document.removeEventListener("webkitfullscreenchange", syncWithDocument);
      document.removeEventListener("fullscreenerror", syncWithDocument);
      window.removeEventListener("orientationchange", syncWithDocument);
      window.removeEventListener("pageshow", syncWithDocument);
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

  /**
   * Phones are held upright but videos are wide, so fullscreen asks for
   * landscape. The lock is best-effort: desktops have nothing to rotate and
   * iOS refuses outright, and neither should stop fullscreen from happening.
   */
  async function requestLandscape() {
    if (!supportsOrientationLock()) {
      return;
    }

    await lockLandscapeOrientation();
  }

  async function enter() {
    if (controller.supportsNative) {
      try {
        if (await controller.enterNative()) {
          wasNativeRef.current = true;
          setIsNative(true);
          setIsVirtual(false);
          await requestLandscape();
          return;
        }
      } catch {
        // Fall through to the CSS-driven fullscreen below.
      }
    }

    wasNativeRef.current = false;
    setIsNative(false);
    setIsVirtual(true);
    await requestLandscape();
  }

  async function exit() {
    wasNativeRef.current = false;
    await controller.exitNative();
    unlockScreenOrientation();
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
