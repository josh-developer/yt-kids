export const STORAGE_KEYS = {
  library: "kidtube-library-v1",
  theme: "kidtube-theme-v1",
  recommendations: "kidtube-recommendations-v1",
} as const;

/** Player preferences follow the tab, not the device. */
export const SESSION_KEYS = {
  playerMuted: "kidtube-player-muted",
  playerVolume: "kidtube-player-volume",
} as const;

/** Bumped whenever `StoredLibrary` changes shape; drives migrations on read. */
export const LIBRARY_VERSION = 7;

export const MAX_WATCH_STACK_SIZE = 200;

export const PLAYLIST_IMPORT_CHUNK_SIZE = 8;

export const SEEK_STEP_SECONDS = 15;

export const DEFAULT_VOLUME = 80;

/** How long the player covers the embed while it boots. */
export const PLAYER_SKELETON_MS = 1200;
