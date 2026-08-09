export type Theme = "dark" | "light";

export type FullscreenHostElement = HTMLDivElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export type FullscreenHostDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

/** `ScreenOrientation.lock` is not in the DOM lib yet. */
export type OrientationLock =
  | "any"
  | "landscape"
  | "landscape-primary"
  | "landscape-secondary"
  | "natural"
  | "portrait"
  | "portrait-primary"
  | "portrait-secondary";

export type OrientationWithLock = ScreenOrientation & {
  lock?: (orientation: OrientationLock) => Promise<void>;
  unlock?: () => void;
};

export function isLikelyTvBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /appletv|aquos|aftb|aftm|afts|aftt|bravia|crkey|dtv|googletv|hbbtv|netcast|roku|smart-tv|smarttv|tizen|tv safari|viera|web0s|webos/i.test(
    navigator.userAgent,
  );
}

export function preferredDeviceTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function isIosLikeBrowser() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export async function lockLandscapeOrientation() {
  try {
    const orientation = screen.orientation as OrientationWithLock | undefined;
    await orientation?.lock?.("landscape");
    return true;
  } catch {
    // Some mobile browsers only allow orientation lock in native fullscreen, and iOS ignores it.
    return false;
  }
}

export function unlockScreenOrientation() {
  try {
    const orientation = screen.orientation as OrientationWithLock | undefined;
    orientation?.unlock?.();
  } catch {
    // Browser support is uneven; exiting fullscreen still works without unlock.
  }
}

export function supportsOrientationLock() {
  if (typeof screen === "undefined") {
    return false;
  }

  const orientation = screen.orientation as OrientationWithLock | undefined;
  return typeof orientation?.lock === "function";
}

export function isPhysicallyLandscape() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.matchMedia("(orientation: landscape)").matches;
}
