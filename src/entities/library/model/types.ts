import type { Video } from "@/entities/video";

/** Serialized shape of the library in storage and in transfer codes. */
export type StoredLibrary = {
  version: number;
  selectedIds: string[];
  customVideos: Video[];
  removedIds: string[];
};
