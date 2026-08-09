import { LIBRARY_VERSION } from "@/shared/config/app-config";
import { shuffleWithSeed, unique } from "@/shared/lib/collections";
import { matchesQuery, type Video } from "@/entities/video";
import type { StoredLibrary } from "./types";
import type { VideoCatalog } from "./video-catalog";

/**
 * The parent-approved library, as a value.
 *
 * Every operation returns a new `VideoLibrary` instead of mutating, so React
 * state updates stay a plain assignment and the rules ("removing a catalog
 * video tombstones it, removing a custom video deletes it") live in one place
 * rather than in each event handler.
 */
export class VideoLibrary {
  /** Catalog + parent-added videos, minus everything removed. */
  readonly videos: Video[];
  /** Approved videos, in the parent's chosen order. */
  readonly approvedVideos: Video[];
  private readonly videoById: Map<string, Video>;
  private readonly approvedIds: Set<string>;

  private constructor(
    private readonly catalog: VideoCatalog,
    private readonly state: StoredLibrary,
  ) {
    const removed = new Set(state.removedIds);
    this.videos = [...catalog.videos, ...state.customVideos].filter(
      (video) => !removed.has(video.id),
    );
    this.videoById = new Map(this.videos.map((video) => [video.id, video]));
    this.approvedIds = new Set(state.selectedIds);
    this.approvedVideos = state.selectedIds
      .map((id) => this.videoById.get(id))
      .filter((video): video is Video => Boolean(video));
  }

  static from(catalog: VideoCatalog, state: StoredLibrary) {
    return new VideoLibrary(catalog, state);
  }

  static default(catalog: VideoCatalog) {
    return new VideoLibrary(catalog, {
      version: LIBRARY_VERSION,
      selectedIds: catalog.ids,
      customVideos: [],
      removedIds: [],
    });
  }

  toJSON(): StoredLibrary {
    return this.state;
  }

  get approvedCount() {
    return this.approvedVideos.length;
  }

  isApproved(id: string) {
    return this.approvedIds.has(id);
  }

  find(id: string) {
    return this.videoById.get(id) ?? null;
  }

  findByVideoId(videoId: string) {
    return this.videos.find((video) => video.videoId === videoId) ?? null;
  }

  search(query: string) {
    return this.videos.filter((video) => matchesQuery(video, query));
  }

  /** Approved videos matching the query, shuffled for the home feed. */
  feed(query: string, salt: number) {
    return shuffleWithSeed(
      this.approvedVideos.filter((video) => matchesQuery(video, query)),
      salt,
    );
  }

  recommendationsFor(video: Video, salt: number) {
    return shuffleWithSeed(
      this.approvedVideos.filter((candidate) => candidate.id !== video.id),
      salt + video.id.length,
    );
  }

  approve(id: string) {
    return this.approvedIds.has(id)
      ? this
      : this.withState({ selectedIds: [id, ...this.state.selectedIds] });
  }

  hide(id: string) {
    return this.withState({
      selectedIds: this.state.selectedIds.filter(
        (selectedId) => selectedId !== id,
      ),
    });
  }

  approveAll() {
    return this.withState({ selectedIds: this.videos.map((v) => v.id) });
  }

  hideAll() {
    return this.withState({ selectedIds: [] });
  }

  reset() {
    return VideoLibrary.default(this.catalog);
  }

  /**
   * Catalog videos cannot be deleted, only tombstoned, so a reset can bring
   * them back. Parent-added videos are dropped outright.
   */
  remove(video: Video) {
    return this.withState({
      selectedIds: this.state.selectedIds.filter((id) => id !== video.id),
      customVideos:
        video.source === "custom"
          ? this.state.customVideos.filter((stored) => stored.id !== video.id)
          : this.state.customVideos,
      removedIds:
        video.source === "catalog"
          ? unique([...this.state.removedIds, video.id])
          : this.state.removedIds.filter((id) => id !== video.id),
    });
  }

  /** Adds parent-added videos, newest first, approving them by default. */
  addCustomVideos(videos: Video[], { approve = true } = {}) {
    const known = new Set(this.state.customVideos.map((v) => v.videoId));
    const fresh = videos.filter((video) => !known.has(video.videoId));

    if (fresh.length === 0) {
      return approve ? this.approveMany(videos.map((v) => v.id)) : this;
    }

    return this.withState({
      customVideos: [...fresh, ...this.state.customVideos],
      selectedIds: approve
        ? unique([...fresh.map((v) => v.id), ...this.state.selectedIds])
        : this.state.selectedIds,
    });
  }

  /**
   * Adds a whole playlist: newly fetched videos are stored, and every playlist
   * entry the library already knows is approved, keeping the playlist order.
   */
  addPlaylist(playlistVideoIds: string[], importedVideos: Video[]) {
    const withImports = this.addCustomVideos(importedVideos, {
      approve: false,
    });
    const idsFromPlaylist = playlistVideoIds
      .map((videoId) => withImports.findByVideoId(videoId)?.id)
      .filter((id): id is string => Boolean(id));

    return withImports.approveMany(idsFromPlaylist);
  }

  approveMany(ids: string[]) {
    const removed = new Set(this.state.removedIds);
    return this.withState({
      selectedIds: unique([
        ...ids.filter((id) => !removed.has(id)),
        ...this.state.selectedIds,
      ]),
    });
  }

  /** Backfills a duration once the player reports the real one. */
  withDuration(video: Video, duration: string) {
    if (video.source !== "custom") {
      return this;
    }

    let changed = false;
    const customVideos = this.state.customVideos.map((stored) => {
      if (stored.id !== video.id || stored.duration === duration) {
        return stored;
      }

      changed = true;
      return { ...stored, duration };
    });

    return changed ? this.withState({ customVideos }) : this;
  }

  private withState(patch: Partial<StoredLibrary>) {
    return new VideoLibrary(this.catalog, {
      ...this.state,
      ...patch,
      version: LIBRARY_VERSION,
    });
  }
}
