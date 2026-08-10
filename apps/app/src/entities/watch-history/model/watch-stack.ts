import { MAX_WATCH_STACK_SIZE } from "@/shared/config/app-config";
import type { Video } from "@/entities/video";

export type WatchStackEntry = { index: number; video: Video };

/** Resolves a stored id against whatever the library currently holds. */
export type VideoLookup = (id: string) => Video | null;

/**
 * Browser-history-like trail of watched videos, so "previous" means the video
 * the child actually came from rather than the previous item in the feed.
 * Immutable: every navigation produces a new stack.
 */
export class WatchStack {
  private constructor(
    readonly ids: string[],
    readonly index: number,
  ) {}

  static empty() {
    return new WatchStack([], -1);
  }

  static startingAt(videoId: string) {
    return new WatchStack([videoId], 0);
  }

  get currentId() {
    return this.ids[this.index] ?? null;
  }

  /** Appends after the current position, truncating any forward entries. */
  push(videoId: string) {
    if (this.currentId === videoId) {
      return this;
    }

    const prefix = this.index >= 0 ? this.ids.slice(0, this.index + 1) : [];
    const ids = [...prefix, videoId].slice(-MAX_WATCH_STACK_SIZE);
    return new WatchStack(ids, ids.length - 1);
  }

  /** Jumps to a known position, used when stepping back through the trail. */
  moveToIndex(index: number) {
    return index >= 0 && index < this.ids.length
      ? new WatchStack(this.ids, index)
      : this;
  }

  /** Back/forward gestures land on an entry that is already in the trail. */
  moveTo(videoId: string) {
    const existing = this.ids.lastIndexOf(videoId);
    return existing >= 0 ? new WatchStack(this.ids, existing) : this.push(videoId);
  }

  previous(currentId: string, lookup: VideoLookup) {
    return this.neighbour(currentId, -1, lookup);
  }

  next(currentId: string, lookup: VideoLookup) {
    return this.neighbour(currentId, 1, lookup);
  }

  private neighbour(
    currentId: string,
    direction: -1 | 1,
    lookup: VideoLookup,
  ): WatchStackEntry | null {
    const currentIndex =
      this.currentId === currentId ? this.index : this.ids.lastIndexOf(currentId);

    if (currentIndex < 0) {
      return null;
    }

    for (
      let index = currentIndex + direction;
      index >= 0 && index < this.ids.length;
      index += direction
    ) {
      const video = lookup(this.ids[index]);
      if (video && video.id !== currentId) {
        return { index, video };
      }
    }

    return null;
  }
}
