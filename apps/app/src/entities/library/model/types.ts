import type { Video } from "@/entities/video";

/**
 * How a watch-page sidebar is split: the series window around the video
 * playing (previous episode, next few), then a fully shuffled batch of
 * everything else.
 */
export type RecommendationGroupKey = "series" | "recommended";

export type RecommendationGroup = {
  key: RecommendationGroupKey;
  videos: Video[];
};

/** A parent-added video, carrying its own approval state. */
export type CustomLibraryVideo = Video & { status: "visible" | "hidden" };

/**
 * Serialized shape of the library in storage and in transfer codes. Catalog
 * (default) videos are approved unless their id is in `hiddenIds`; a parent
 * removing one instead tombstones it in `removedIds` so a reset can restore
 * it. Custom videos carry their own `status` and disappear outright on
 * removal, since there is nothing to restore them from.
 */
export type StoredLibrary = {
  version: number;
  customVideos: CustomLibraryVideo[];
  removedIds: string[];
  hiddenIds: string[];
};
