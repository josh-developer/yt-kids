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

/** Serialized shape of the library in storage and in transfer codes. */
export type StoredLibrary = {
  version: number;
  selectedIds: string[];
  customVideos: Video[];
  removedIds: string[];
};
