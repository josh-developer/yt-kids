import { LIBRARY_VERSION } from "@/shared/config/app-config";
import { unique } from "@/shared/lib/collections";
import type { StoredLibrary } from "./types";
import type { VideoCatalog } from "./video-catalog";

/** First catalog number shipped with library version 7. */
const VERSION_7_FIRST_CATALOG_NUMBER = 290;

/**
 * Brings a stored payload of any past version up to the current one and drops
 * references to videos that no longer exist.
 */
export function normalizeStoredLibrary(
  catalog: VideoCatalog,
  library: StoredLibrary,
): StoredLibrary {
  const customVideos = Array.isArray(library.customVideos)
    ? library.customVideos
    : [];
  const customIds = new Set(customVideos.map((video) => video.id));
  const validIds = new Set([...catalog.ids, ...customIds]);
  const removedIds = Array.isArray(library.removedIds)
    ? library.removedIds.filter((id) => validIds.has(id))
    : [];
  const removed = new Set(removedIds);
  const storedSelectedIds = Array.isArray(library.selectedIds)
    ? library.selectedIds.filter((id) => validIds.has(id) && !removed.has(id))
    : catalog.ids;

  const selectedIds =
    library.version === LIBRARY_VERSION
      ? storedSelectedIds
      : migrateSelection(catalog, library.version, storedSelectedIds, customIds);

  return {
    version: LIBRARY_VERSION,
    customVideos,
    removedIds,
    selectedIds: selectedIds.filter((id) => !removed.has(id)),
  };
}

function migrateSelection(
  catalog: VideoCatalog,
  version: number,
  storedSelectedIds: string[],
  customIds: Set<string>,
) {
  // v6 predates the newest catalog batch: keep the parent's choices and add it.
  if (version === 6) {
    return unique([
      ...storedSelectedIds,
      ...catalog.idsAddedFrom(VERSION_7_FIRST_CATALOG_NUMBER),
    ]);
  }

  // v2-v5 stored a subset of the catalog: re-approve the full catalog on top.
  if (version >= 2 && version <= 5) {
    return unique([...catalog.ids, ...storedSelectedIds]);
  }

  // Anything older only keeps its parent-added videos.
  return [
    ...catalog.ids,
    ...storedSelectedIds.filter((id) => customIds.has(id)),
  ];
}
