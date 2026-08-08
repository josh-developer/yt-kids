import type { OrientationWithLock, Theme } from "./types";

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

export function preferredLanguage() {
  if (typeof navigator === "undefined") {
    return "en";
  }

  return navigator.language.toLowerCase().startsWith("uz") ? "uz" : "en";
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
  } catch {
    // Some mobile browsers only allow orientation lock in native fullscreen, and iOS ignores it.
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
