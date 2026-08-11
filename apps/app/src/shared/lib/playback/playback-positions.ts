import { SESSION_KEYS } from "@/shared/config/app-config";
import {
  createSessionStore,
  type KeyValueStore,
} from "@/shared/lib/storage/key-value-store";

/** Below this, there is nothing worth returning to. */
const MIN_RESUMABLE_SECONDS = 5;

/** This close to the end counts as watched, so the next visit starts over. */
const END_MARGIN_SECONDS = 15;

/** Only every this many seconds of progress reaches storage. */
const SAVE_STEP_SECONDS = 5;

/** Oldest entries are dropped past this, so the map cannot grow forever. */
const MAX_TRACKED_VIDEOS = 50;

/**
 * Where each video was left off, so leaving a video and coming back resumes
 * instead of starting over.
 *
 * Positions follow the tab rather than the device, matching the rest of the
 * player's state — a fresh tab starts clean. Keys are opaque strings, so this
 * knows nothing about videos beyond their id.
 */
export class PlaybackPositions {
  private lastSavedSeconds = 0;

  constructor(private readonly store: KeyValueStore = createSessionStore()) {}

  /** Returns 0 when there is nothing worth resuming. */
  read(videoId: string) {
    const seconds = this.readAll()[videoId];
    return typeof seconds === "number" && seconds >= MIN_RESUMABLE_SECONDS
      ? seconds
      : 0;
  }

  /**
   * Records progress. Storage is touched at most once per `SAVE_STEP_SECONDS`
   * of playback — progress arrives several times a second, and storage needs
   * none of that resolution. The gate covers the clearing paths too, not just
   * the write: they parse the stored map as well, and without it every tick of
   * a video's opening seconds and closing seconds would do it again. Passing a
   * duration lets a finished video drop its entry so it opens from the start
   * next time.
   */
  save(videoId: string, seconds: number, durationSeconds = 0) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return;
    }

    if (Math.abs(seconds - this.lastSavedSeconds) < SAVE_STEP_SECONDS) {
      return;
    }

    this.lastSavedSeconds = seconds;

    const hasFinished =
      durationSeconds > 0 && seconds >= durationSeconds - END_MARGIN_SECONDS;

    if (hasFinished || seconds < MIN_RESUMABLE_SECONDS) {
      this.forget(videoId);
      return;
    }

    const positions = this.readAll();
    delete positions[videoId];
    positions[videoId] = seconds;
    this.writeAll(positions);
  }

  forget(videoId: string) {
    const positions = this.readAll();
    if (!(videoId in positions)) {
      return;
    }
    delete positions[videoId];
    this.writeAll(positions);
  }

  private readAll(): Record<string, number> {
    const raw = this.store.read(SESSION_KEYS.playerPositions);
    if (!raw) {
      return {};
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, number>)
        : {};
    } catch {
      // A hand-edited or half-written entry is not worth reporting; the
      // viewer loses a resume point, nothing more.
      return {};
    }
  }

  private writeAll(positions: Record<string, number>) {
    // Insertion order is oldest-first, so the newest entries survive.
    const entries = Object.entries(positions);
    const kept =
      entries.length > MAX_TRACKED_VIDEOS
        ? entries.slice(entries.length - MAX_TRACKED_VIDEOS)
        : entries;

    this.store.write(
      SESSION_KEYS.playerPositions,
      JSON.stringify(Object.fromEntries(kept)),
    );
  }
}
