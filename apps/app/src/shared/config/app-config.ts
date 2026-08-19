export const STORAGE_KEYS = {
  library: "kidtube-library-v2",
  /** Retired key, read once to migrate a returning parent onto `library`. */
  legacyLibrary: "kidtube-library-v1",
  theme: "kidtube-theme-v1",
  recommendations: "kidtube-recommendations-v1",
} as const;

/** Player preferences follow the tab, not the device. */
export const SESSION_KEYS = {
  playerMuted: "kidtube-player-muted",
  playerVolume: "kidtube-player-volume",
  playerPositions: "kidtube-player-positions",
} as const;

/**
 * Schema version for the `kidtube-library-v2` payload. Bump only if this
 * shape changes again — new catalog videos don't need a bump, they're
 * approved by default until a parent hides them.
 */
export const LIBRARY_VERSION = 1;

export const MAX_WATCH_STACK_SIZE = 200;

export const PLAYLIST_IMPORT_CHUNK_SIZE = 8;

export const SEEK_STEP_SECONDS = 15;

export const DEFAULT_VOLUME = 80;

/**
 * Last-resort ceiling only. In practice the spinner clears much sooner, either
 * because playback reports it started or via `PLAYER_STARTED_FALLBACK_MS`.
 */
export const PLAYER_SKELETON_MS = 8000;

/**
 * Some browsers never fire `load` for a cross-origin iframe, so the embed is
 * primed on a short timer too.
 */
export const PLAYER_BOOT_KICK_MS = 450;

/**
 * How long to wait, after sending the first play command, before giving up on
 * silent autoplay confirmation and showing the app-owned play button. Positive
 * paused/error telemetry can still clear the loader earlier.
 */
export const PLAYER_STARTED_FALLBACK_MS = 2500;

/**
 * If the embed has not said a single word by now it is not going to: the
 * network, a VPN, or a filter is blocking YouTube. Offer a retry instead of
 * leaving a black rectangle.
 */
export const PLAYER_UNREACHABLE_MS = 18000;

/**
 * How long the next video waits before it starts on its own. Long enough to
 * read the title and reach the replay button, short enough not to feel stuck.
 */
export const AUTOPLAY_COUNTDOWN_SECONDS = 4;
