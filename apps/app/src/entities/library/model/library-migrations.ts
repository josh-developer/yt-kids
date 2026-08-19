import { LIBRARY_VERSION } from "@/shared/config/app-config";
import { unique } from "@/shared/lib/collections";
import type { Video } from "@/entities/video";
import type { CustomLibraryVideo, StoredLibrary } from "./types";
import type { VideoCatalog } from "./video-catalog";

/** Loosely-typed shape of a payload written by the retired `kidtube-library-v1` key. */
type LegacyStoredLibraryV1 = {
  version?: number;
  selectedIds?: unknown;
  customVideos?: unknown;
  removedIds?: unknown;
};

/**
 * Brings a stored payload up to the current shape and drops references to
 * videos that no longer exist. Catalog videos need no reconciliation when a
 * new batch ships — they are approved by default unless a parent hid them.
 */
export function normalizeStoredLibrary(
  catalog: VideoCatalog,
  library: StoredLibrary,
): StoredLibrary {
  const customVideos = sanitizeCustomVideos(library.customVideos);
  const removedIds = Array.isArray(library.removedIds)
    ? unique(library.removedIds.filter((id) => catalog.has(id)))
    : [];
  const removed = new Set(removedIds);
  const hiddenIds = Array.isArray(library.hiddenIds)
    ? unique(
        library.hiddenIds.filter((id) => catalog.has(id) && !removed.has(id)),
      )
    : [];

  return { version: LIBRARY_VERSION, customVideos, removedIds, hiddenIds };
}

function sanitizeCustomVideos(value: unknown): CustomLibraryVideo[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return (value as CustomLibraryVideo[]).map((video) => ({
    ...video,
    status: video.status === "hidden" ? "hidden" : "visible",
  }));
}

/**
 * One-time upgrade from the retired `kidtube-library-v1` payload. Its
 * `selectedIds` snapshot becomes the inverse: every catalog id it left out
 * turns into an explicit `hiddenIds` entry, and each custom video gets its
 * own `status` instead of relying on shared list membership.
 */
export function migrateFromV1(
  catalog: VideoCatalog,
  legacy: LegacyStoredLibraryV1,
): StoredLibrary {
  const selected = new Set(
    Array.isArray(legacy.selectedIds) ? legacy.selectedIds : catalog.ids,
  );
  const removedIds = Array.isArray(legacy.removedIds)
    ? legacy.removedIds
    : [];
  const removed = new Set(removedIds);
  const legacyCustomVideos = (
    Array.isArray(legacy.customVideos) ? legacy.customVideos : []
  ) as Video[];

  const hiddenIds = catalog.ids.filter(
    (id) => !removed.has(id) && !selected.has(id),
  );
  const customVideos: CustomLibraryVideo[] = legacyCustomVideos.map(
    (video) => ({
      ...video,
      status: selected.has(video.id) ? "visible" : "hidden",
    }),
  );

  return normalizeStoredLibrary(catalog, {
    version: LIBRARY_VERSION,
    customVideos,
    removedIds,
    hiddenIds,
  });
}
