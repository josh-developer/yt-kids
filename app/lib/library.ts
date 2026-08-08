import {
  CATALOG,
  DEFAULT_LIBRARY,
  DEFAULT_SELECTED_IDS,
  LIBRARY_VERSION,
  NEW_DEFAULT_SELECTED_IDS,
  STORAGE_KEY,
} from "./catalog";
import type { StoredLibrary, Video } from "./types";

export function normalizeStoredLibrary(library: StoredLibrary): StoredLibrary {
  const customVideos = Array.isArray(library.customVideos)
    ? library.customVideos
    : [];
  const customVideoIds = new Set(customVideos.map((video) => video.id));
  const validIds = new Set([
    ...CATALOG.map((video) => video.id),
    ...customVideoIds,
  ]);
  const removedIds = Array.isArray(library.removedIds)
    ? library.removedIds.filter((id) => validIds.has(id))
    : [];
  const removedIdSet = new Set(removedIds);
  const storedSelectedIds = Array.isArray(library.selectedIds)
    ? library.selectedIds.filter((id) => validIds.has(id) && !removedIdSet.has(id))
    : DEFAULT_SELECTED_IDS;

  if (library.version !== LIBRARY_VERSION) {
    const selectedCustomIds = storedSelectedIds.filter((id) =>
      customVideoIds.has(id),
    );
    const migratedSelectedIds =
      library.version === 6
        ? Array.from(new Set([...storedSelectedIds, ...NEW_DEFAULT_SELECTED_IDS]))
        : library.version >= 2 && library.version <= 5
          ? Array.from(new Set([...DEFAULT_SELECTED_IDS, ...storedSelectedIds]))
          : [...DEFAULT_SELECTED_IDS, ...selectedCustomIds];

    return {
      version: LIBRARY_VERSION,
      customVideos,
      removedIds,
      selectedIds: migratedSelectedIds.filter(
        (id) => !removedIdSet.has(id),
      ),
    };
  }

  return {
    version: LIBRARY_VERSION,
    customVideos,
    removedIds,
    selectedIds: storedSelectedIds,
  };
}

export function readStoredLibrary(): StoredLibrary {
  if (typeof window === "undefined") {
    return DEFAULT_LIBRARY;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return DEFAULT_LIBRARY;
  }

  try {
    const parsed = JSON.parse(raw) as StoredLibrary;
    return normalizeStoredLibrary(parsed);
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return DEFAULT_LIBRARY;
  }
}

export function shuffleVideos(videos: Video[], salt: number) {
  const shuffled = [...videos];
  let seed = salt || 17;
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    seed = (seed * 9301 + 49297) % 233280;
    const pick = Math.floor((seed / 233280) * (index + 1));
    [shuffled[index], shuffled[pick]] = [shuffled[pick], shuffled[index]];
  }
  return shuffled;
}
