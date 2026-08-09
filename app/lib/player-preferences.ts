const MUTED_STORAGE_KEY = "kidtube-player-muted";
const VOLUME_STORAGE_KEY = "kidtube-player-volume";

export function readStoredPlayerMuted(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.sessionStorage.getItem(MUTED_STORAGE_KEY) === "1";
}

export function storePlayerMuted(isMuted: boolean) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(MUTED_STORAGE_KEY, isMuted ? "1" : "0");
}

export function readStoredPlayerVolume(): number {
  if (typeof window === "undefined") {
    return 80;
  }

  const rawValue = window.sessionStorage.getItem(VOLUME_STORAGE_KEY);
  if (rawValue === null) {
    return 80;
  }

  const stored = Number(rawValue);
  return Number.isFinite(stored) && stored >= 0 && stored <= 100 ? stored : 80;
}

export function storePlayerVolume(volume: number) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(VOLUME_STORAGE_KEY, String(volume));
}
