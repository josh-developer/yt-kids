import type { Video } from "@/entities/video";

/**
 * How a watch-page sidebar is split: the rest of the same serial first, then
 * videos with related titles, then everything else.
 */
export type RecommendationGroupKey = "series" | "similar" | "more";

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
