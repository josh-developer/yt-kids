import { DEFAULT_VOLUME, SESSION_KEYS } from "@/shared/config/app-config";
import type { KeyValueStore } from "@/shared/lib/storage/key-value-store";
import { clamp } from "@/shared/lib/time";

/**
 * Volume and mute survive moving between videos, but not closing the tab: a
 * child muting one video should not silently mute the app forever.
 */
export class PlayerPreferences {
  constructor(private readonly store: KeyValueStore) {}

  readMuted() {
    return this.store.read(SESSION_KEYS.playerMuted) === "1";
  }

  saveMuted(isMuted: boolean) {
    this.store.write(SESSION_KEYS.playerMuted, isMuted ? "1" : "0");
  }

  readCaptions() {
    return this.store.read(SESSION_KEYS.playerCaptions) === "1";
  }

  saveCaptions(areEnabled: boolean) {
    this.store.write(SESSION_KEYS.playerCaptions, areEnabled ? "1" : "0");
  }

  readVolume() {
    const stored = Number(this.store.read(SESSION_KEYS.playerVolume));
    return Number.isFinite(stored) && stored >= 0 && stored <= 100
      ? stored
      : DEFAULT_VOLUME;
  }

  saveVolume(volume: number) {
    this.store.write(
      SESSION_KEYS.playerVolume,
      String(clamp(Math.round(volume), 0, 100)),
    );
  }
}
