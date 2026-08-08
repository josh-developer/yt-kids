import { CURATED_UZBEK_OLD_CARTOONS } from "../curated-videos";
import type { StoredLibrary, Video } from "./types";

export const STORAGE_KEY = "kidtube-library-v1";
export const THEME_STORAGE_KEY = "kidtube-theme-v1";
export const LANGUAGE_STORAGE_KEY = "kidtube-language-v1";
export const TRANSFER_PREFIX = "KIDTUBE1";
export const TRANSFER_SECRET = "kidtube-parent-library-transfer-v1";
export const LIBRARY_VERSION = 7;
export const MAX_WATCH_STACK_SIZE = 200;

export const CATALOG: Video[] = CURATED_UZBEK_OLD_CARTOONS;

export const CATALOG_NUMBER_BY_ID = new Map(
  CATALOG.map((video) => [
    video.id,
    Number(video.id.replace("uzbek-old-", "")),
  ] as const),
);

export const CATALOG_ID_BY_NUMBER = new Map(
  CATALOG.map((video) => [
    Number(video.id.replace("uzbek-old-", "")),
    video.id,
  ] as const),
);

export const NEW_DEFAULT_SELECTED_IDS = CATALOG.filter(
  (video) => (CATALOG_NUMBER_BY_ID.get(video.id) ?? 0) >= 290,
).map((video) => video.id);

export const DEFAULT_SELECTED_IDS = CATALOG.map((video) => video.id);

export const DEFAULT_LIBRARY: StoredLibrary = {
  version: LIBRARY_VERSION,
  selectedIds: DEFAULT_SELECTED_IDS,
  customVideos: [],
  removedIds: [],
};
