import { useEffect } from "react";

type WakeLockCapableNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<WakeLockSentinel>;
  };
};

/**
 * Keeps the display awake only while playback needs it. Browsers may deny or
 * release the lock at any time, so every path treats failure as a harmless no-op.
 */
export function useScreenWakeLock(isActive: boolean) {
  useEffect(() => {
    if (!isActive || typeof document === "undefined") {
      return;
    }

    const wakeLock = (navigator as WakeLockCapableNavigator).wakeLock;
    if (!wakeLock) {
      return;
    }

    let sentinel: WakeLockSentinel | null = null;
    let isMounted = true;
    let isRequesting = false;

    async function requestLock() {
      if (
        !isMounted ||
        sentinel ||
        isRequesting ||
        document.visibilityState !== "visible"
      ) {
        return;
      }

      isRequesting = true;
      try {
        const lock = await wakeLock.request("screen");
        if (!isMounted || document.visibilityState !== "visible") {
          void lock.release().catch(() => {
            // The browser may have already released it.
          });
          return;
        }

        sentinel = lock;
        lock.addEventListener("release", () => {
          if (sentinel === lock) {
            sentinel = null;
          }
        });
      } catch {
        sentinel = null;
      } finally {
        isRequesting = false;
      }
    }

    function releaseLock() {
      const lock = sentinel;
      sentinel = null;
      void lock?.release().catch(() => {
        // The browser may have already released it.
      });
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void requestLock();
        return;
      }

      releaseLock();
    }

    void requestLock();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      releaseLock();
    };
  }, [isActive]);
}
