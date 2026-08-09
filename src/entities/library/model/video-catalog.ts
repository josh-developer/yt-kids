import type { Video } from "@/entities/video";
import { CURATED_UZBEK_OLD_CARTOONS } from "./curated-videos";

/**
 * The read-only, shipped-with-the-app video list.
 *
 * It also owns the id <-> number mapping that lets transfer codes reference a
 * catalog video by a short number instead of its full id.
 */
export class VideoCatalog {
  private readonly numberById: Map<string, number>;
  private readonly idByNumber: Map<number, string>;

  constructor(readonly videos: Video[]) {
    const numbered = videos.map(
      (video) => [video.id, Number(video.id.replace("uzbek-old-", ""))] as const,
    );
    this.numberById = new Map(numbered);
    this.idByNumber = new Map(
      numbered.map(([id, number]) => [number, id] as const),
    );
  }

  get ids() {
    return this.videos.map((video) => video.id);
  }

  has(id: string) {
    return this.numberById.has(id);
  }

  /** Short reference used by transfer codes; falls back to the raw id. */
  compactRef(id: string): number | string {
    return this.numberById.get(id) ?? id;
  }

  expandRef(ref: number | string) {
    return typeof ref === "number" ? (this.idByNumber.get(ref) ?? null) : ref;
  }

  /** Videos added in library version 7, used when migrating from version 6. */
  idsAddedFrom(catalogNumber: number) {
    return this.videos
      .filter((video) => (this.numberById.get(video.id) ?? 0) >= catalogNumber)
      .map((video) => video.id);
  }
}

export const CATALOG = new VideoCatalog(CURATED_UZBEK_OLD_CARTOONS);
