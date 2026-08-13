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
  /** Videos a parent added by URL. Not in `@repo/catalog`, so they are stored whole. */
  const [customVideos, setCustomVideos] = useState<readonly Video[]>([]);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [hidden, custom] = await Promise.all([
        readPreference(STORAGE_KEYS.hiddenVideos),
        readPreference(STORAGE_KEYS.customVideos),
      ]);
      if (cancelled) {
        return;
      }

      setHiddenIds(new Set(parseIds(hidden)));
      setCustomVideos(parseVideos(custom));
      setIsReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((ids: ReadonlySet<string>) => {
    void writePreference(STORAGE_KEYS.hiddenVideos, JSON.stringify([...ids]));
  }, []);

  const persistCustom = useCallback((videos: readonly Video[]) => {
    void writePreference(STORAGE_KEYS.customVideos, JSON.stringify(videos));
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

  /**
   * A parent's own videos come first, because they went out of their way to add them and
   * would otherwise have to scroll past four hundred cartoons to find one.
   */
  const allVideos = useMemo(
    () => [...customVideos, ...CURATED_UZBEK_OLD_CARTOONS],
    [customVideos],
  );

  const approvedVideos = useMemo(
    () => allVideos.filter((video) => !hiddenIds.has(video.id)),
    [allVideos, hiddenIds],
  );

  const hiddenVideos = useMemo(
    () => allVideos.filter((video) => hiddenIds.has(video.id)),
    [allVideos, hiddenIds],
  );

  /**
   * Adds a video the parent chose, and approves it.
   *
   * Building the video is the transfer feature's job — it owns the URL parsing and the
   * shape a code carries — so this takes a finished one. An id already in the library is
   * un-hidden rather than duplicated.
   */
  const addVideo = useCallback(
    (video: Video) => {
      const existing = allVideos.find(
        (candidate) => candidate.videoId === video.videoId,
      );

      if (!existing) {
        setCustomVideos((current) => {
          const next = [video, ...current];
          persistCustom(next);
          return next;
        });
      }

      approve(existing?.id ?? video.id);
      return { video: existing ?? video, wasAlreadyThere: Boolean(existing) };
    },
    [allVideos, approve, persistCustom],
  );

  /**
   * The library, in the terms a transfer code is written in: what is selected, what was
   * removed, and the parent's own videos.
   */
  const snapshot = useCallback(
    () => ({
      selectedIds: approvedVideos.map((video) => video.id),
      removedIds: [...hiddenIds],
      customVideos: [...customVideos],
    }),
    [approvedVideos, customVideos, hiddenIds],
  );

  /**
   * Replaces the library with what an imported code carried.
   *
   * A code names what is *selected*; this app stores what is hidden, so the two are
   * reconciled here — everything not selected becomes hidden. That is what lets a code
   * written on the web land as the same library on a phone.
   */
  const replaceLibrary = useCallback(
    (next: { selectedIds: string[]; customVideos: readonly Video[] }) => {
      const selected = new Set(next.selectedIds);
      const merged = mergeCustomVideos(customVideos, next.customVideos);
      const hidden = new Set(
        [...merged, ...CURATED_UZBEK_OLD_CARTOONS]
          .map((video) => video.id)
          .filter((id) => !selected.has(id)),
      );

      setCustomVideos(merged);
      persistCustom(merged);
      setHiddenIds(hidden);
      persist(hidden);
    },
    [customVideos, persist, persistCustom],
  );

  /**
   * Back to what the app shipped with: nothing hidden, and no parent-added videos.
   *
   * The web's reset does the same and is the reason the stored value is the *hidden* ids —
   * clearing them is the whole operation, and a catalog that grew in a release comes back
   * with it.
   */
  const resetLibrary = useCallback(() => {
    setHiddenIds(new Set());
    persist(new Set());
    setCustomVideos([]);
    persistCustom([]);
  }, [persist, persistCustom]);

  const feed = useCallback(
    (query: string) =>
      approvedVideos.filter((video) => matchesQuery(video, query)),
    [approvedVideos],
  );

  return {
    isReady,
    videos: allVideos,
    customVideos,
    approvedVideos,
    hiddenVideos,
    approvedCount: approvedVideos.length,
    isApproved: useCallback((id: string) => !hiddenIds.has(id), [hiddenIds]),
    feed,
    approve,
    hide,
    addVideo,
    snapshot,
    replaceLibrary,
    resetLibrary,
  };
}

/** The code's copy of a video wins, since the parent chose to bring it. */
function mergeCustomVideos(
  current: readonly Video[],
  incoming: readonly Video[],
) {
  const byId = new Map(current.map((video) => [video.id, video]));
  for (const video of incoming) {
    byId.set(video.id, video);
  }

  return [...byId.values()];
}

/** A stored value that is not a list of videos is treated as none. */
function parseVideos(stored: string | null): Video[] {
  if (!stored) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (video): video is Video =>
        typeof video === "object" &&
        video !== null &&
        typeof (video as Video).id === "string" &&
        typeof (video as Video).videoId === "string",
    );
  } catch {
    return [];
  }
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
