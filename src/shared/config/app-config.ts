export const STORAGE_KEYS = {
  library: "kidtube-library-v1",
  theme: "kidtube-theme-v1",
} as const;

/** Bumped whenever `StoredLibrary` changes shape; drives migrations on read. */
export const LIBRARY_VERSION = 7;

export const MAX_WATCH_STACK_SIZE = 200;

export const PLAYLIST_IMPORT_CHUNK_SIZE = 8;

export const SEEK_STEP_SECONDS = 15;
