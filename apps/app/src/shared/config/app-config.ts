export const STORAGE_KEYS = {
  library: "kidtube-library-v1",
  theme: "kidtube-theme-v1",
  recommendations: "kidtube-recommendations-v1",
} as const;

/** Player preferences follow the tab, not the device. */
export const SESSION_KEYS = {
  playerMuted: "kidtube-player-muted",
  playerVolume: "kidtube-player-volume",
  playerCaptions: "kidtube-player-captions",
  playerPositions: "kidtube-player-positions",
} as const;

/** Bumped whenever `StoredLibrary` changes shape; drives migrations on read. */
export const LIBRARY_VERSION = 7;

export const MAX_WATCH_STACK_SIZE = 200;

export const PLAYLIST_IMPORT_CHUNK_SIZE = 8;

export const SEEK_STEP_SECONDS = 15;

export const DEFAULT_VOLUME = 80;

/**
 * Last-resort ceiling only. In practice the spinner clears well before this,
 * either because playback reports it started or via `PLAYER_STARTED_FALLBACK_MS`
 * — this just bounds how long a truly stuck embed (the play command itself
 * never went out) can hide behind it.
 */
export const PLAYER_SKELETON_MS = 8000;

/**
 * Some browsers never fire `load` for a cross-origin iframe (TV browsers are
 * the common case), so the embed is primed on a timer as well.
 */
export const PLAYER_BOOT_KICK_MS = 1200;

/**
 * How long to wait, after sending the first play command, before assuming
 * playback started even without telemetry confirming it — clearing both the
 * spinner and the poster. Otherwise they'd keep covering a video that is
 * genuinely playing whenever the embed's postMessage channel is slow or
 * never opens (seen on iOS Safari), for as long as `PLAYER_SKELETON_MS`.
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
