import type { Video } from "@/entities/video";

/**
 * How a watch-page sidebar is split: up to three videos related to the one
 * playing, then a fully shuffled batch of everything else.
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
