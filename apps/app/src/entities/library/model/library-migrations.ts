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
 *
 * A payload stamped below `LIBRARY_VERSION` predates that bump and may
 * carry `hiddenIds` corrupted by whatever the bump fixed (see its comment
 * in `app-config.ts`), so its `hiddenIds` is discarded rather than trusted
 * — catalog videos go back to visible-by-default, same as a fresh install.
 * `removedIds` is unaffected: a tombstone is unambiguous regardless of when
 * it was written, so it is always preserved.
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
  const hiddenIds =
    library.version >= LIBRARY_VERSION && Array.isArray(library.hiddenIds)
      ? unique(
          library.hiddenIds.filter(
            (id) => catalog.has(id) && !removed.has(id),
          ),
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
 * One-time upgrade from the retired `kidtube-library-v1` payload.
 *
 * Catalog videos start fully visible rather than inverting the old
 * `selectedIds` snapshot into `hiddenIds`: a v1 payload can't distinguish
 * "the parent hid this" from "this video didn't exist yet when they last
 * saved," and catalog batches shipped after a parent's last save would
 * otherwise be swept into `hiddenIds` and stay stuck hidden forever. A
 * parent who genuinely hid a default video can hide it again with one tap;
 * that is far cheaper than shipped content silently never appearing.
 * Custom videos carry no such ambiguity — every one of them was already in
 * the payload, so `selectedIds` membership is a real, preservable signal.
 */
export function migrateFromV1(
  catalog: VideoCatalog,
  legacy: LegacyStoredLibraryV1,
): StoredLibrary {
  const selected = new Set(
    Array.isArray(legacy.selectedIds) ? legacy.selectedIds : [],
  );
  const removedIds = Array.isArray(legacy.removedIds)
    ? legacy.removedIds
    : [];
  const legacyCustomVideos = (
    Array.isArray(legacy.customVideos) ? legacy.customVideos : []
  ) as Video[];

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
    hiddenIds: [],
  });
}
