import { CURATED_UZBEK_OLD_CARTOONS } from "@repo/catalog";
import type { Video } from "@repo/catalog/types";
import { useCallback, useEffect, useMemo, useState } from "react";
import { STORAGE_KEYS } from "../../../shared/config/app-config";
import {
  readPreference,
  writePreference,
} from "../../../shared/lib/storage/preferences";
import { matchesQuery } from "../../../shared/lib/format/matches-query";

/**
 * Which videos a parent has approved, and the queries the home screen runs over
 * them.
 *
 * The web models this as a `StoredLibrary` — a version, the approved `selectedIds`,
 * parent-added videos and removed ids — behind a `VideoLibrary` class with
 * migrations. This is the approved-set half of that, which is what the two screens
 * built so far actually need: home shows approved videos, settings moves videos in
 * and out of the set. Parent-added videos, removals and transfer codes are not here
 * yet, and when they arrive this is where they belong.
 *
 * Everything not explicitly hidden is approved, so a fresh install shows the whole
 * curated catalog rather than an empty screen. Storing the *hidden* ids rather than
 * the approved ones is what makes that work: an empty store means nothing hidden,
 * and a catalog that grows in a later release does not need a migration to make its
 * new videos visible.
 */
export type LibraryController = ReturnType<typeof useLibrary>;

export function useLibrary() {
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set());
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const stored = await readPreference(STORAGE_KEYS.hiddenVideos);
      if (cancelled) {
        return;
      }

      setHiddenIds(new Set(parseIds(stored)));
      setIsReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((ids: ReadonlySet<string>) => {
    void writePreference(STORAGE_KEYS.hiddenVideos, JSON.stringify([...ids]));
  }, []);

  const hide = useCallback(
    (id: string) => {
      setHiddenIds((current) => {
        const next = new Set(current).add(id);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const approve = useCallback(
    (id: string) => {
      setHiddenIds((current) => {
        const next = new Set(current);
        next.delete(id);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const approvedVideos = useMemo(
    () =>
      CURATED_UZBEK_OLD_CARTOONS.filter((video) => !hiddenIds.has(video.id)),
    [hiddenIds],
  );

  const hiddenVideos = useMemo(
    () => CURATED_UZBEK_OLD_CARTOONS.filter((video) => hiddenIds.has(video.id)),
    [hiddenIds],
  );

  const feed = useCallback(
    (query: string) =>
      approvedVideos.filter((video) => matchesQuery(video, query)),
    [approvedVideos],
  );

  return {
    isReady,
    videos: CURATED_UZBEK_OLD_CARTOONS as readonly Video[],
    approvedVideos,
    hiddenVideos,
    approvedCount: approvedVideos.length,
    isApproved: useCallback((id: string) => !hiddenIds.has(id), [hiddenIds]),
    feed,
    approve,
    hide,
  };
}

/** A stored value that is not an id array is treated as nothing hidden. */
function parseIds(stored: string | null): string[] {
  if (!stored) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}
