import { LIBRARY_VERSION } from "@/shared/config/app-config";
import { shuffleWithSeed, unique } from "@/shared/lib/collections";
import {
  episodeNumberOf,
  isSameSeries,
  isSimilar,
  matchesQuery,
  signatureSimilarity,
  titleSignature,
  type TitleSignature,
  type Video,
} from "@/entities/video";
import type { CustomLibraryVideo, RecommendationGroup, StoredLibrary } from "./types";
import type { VideoCatalog } from "./video-catalog";

/**
 * A title's signature never changes across edits, so it is worth caching
 * outside any one instance. Keeping these outside the instance is what stops
 * each edit from re-deriving all of it.
 */
const signatureCache = new Map<string, TitleSignature>();

/** How many videos lead a standalone video's "Recommended" group in order. */
const SERIES_GROUP_SIZE = 3;
/** Episodes shown before the current one in the "In this series" group. */
const SERIES_BEFORE = 1;
/** Episodes shown after the current one in the "In this series" group. */
const SERIES_AFTER = 4;
/** How many videos make up the "Recommended" group. */
const RECOMMENDED_GROUP_SIZE = 30;

/**
 * Serial episodes are offered in reading order starting from the one after the
 * current episode, so "next" on episode 4 is episode 5 rather than a random
 * one, and finishing the last episode wraps to the beginning of the series.
 */
function orderEpisodes(videos: Video[], currentEpisode: number | null) {
  const numbered = videos
    .map((video) => ({ video, episode: episodeNumberOf(video.title) }))
    .filter(
      (entry): entry is { video: Video; episode: number } =>
        entry.episode !== null,
    )
    .sort((a, b) => a.episode - b.episode);

  const unnumbered = videos.filter(
    (video) => episodeNumberOf(video.title) === null,
  );

  if (currentEpisode === null) {
    return [...numbered.map((entry) => entry.video), ...unnumbered];
  }

  return [
    ...numbered
      .filter((entry) => entry.episode > currentEpisode)
      .map((entry) => entry.video),
    ...numbered
      .filter((entry) => entry.episode <= currentEpisode)
      .map((entry) => entry.video),
    ...unnumbered,
  ];
}

/**
 * The "In this series" window around the video being watched: the episode
 * right before it, then the next four, in order — the video itself is never
 * part of the list. Wraps at either end of the series, and simply shortens
 * instead of padding when the series itself is smaller than that window.
 */
function seriesWindow(seriesVideos: Video[], current: Video) {
  const numbered = seriesVideos
    .concat(current)
    .map((video) => ({ video, episode: episodeNumberOf(video.title) }))
    .filter(
      (entry): entry is { video: Video; episode: number } =>
        entry.episode !== null,
    )
    .sort((a, b) => a.episode - b.episode)
    .map((entry) => entry.video);
  const unnumbered = seriesVideos
    .concat(current)
    .filter((video) => episodeNumberOf(video.title) === null);
  const ordered = [...numbered, ...unnumbered];

  const currentIndex = ordered.findIndex((entry) => entry.id === current.id);
  const length = ordered.length;
  const span = Math.min(length, SERIES_BEFORE + 1 + SERIES_AFTER);
  const start = ((currentIndex - SERIES_BEFORE) % length + length) % length;

  const window = Array.from(
    { length: span },
    (_, offset) => ordered[(start + offset) % length],
  );

  return window.filter((video) => video.id !== current.id);
}

function recommendationSalt(video: Video, salt: number) {
  let seed = salt || 17;

  for (let index = 0; index < video.id.length; index += 1) {
    seed = (seed * 31 + video.id.charCodeAt(index)) % 233280;
  }

  return seed;
}

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
  /** Approved videos: parent-added ones first, then the catalog in its shipped order. */
  readonly approvedVideos: Video[];
  private readonly videoById: Map<string, Video>;
  private readonly approvedIds: Set<string>;
  private readonly customIds: Set<string>;
  /** Catalog videos minus tombstones — the pool `hiddenIds` is drawn from. */
  private readonly catalogVideos: Video[];
  private playbackOrderCache: { salt: number; videos: Video[] } | null = null;
  /** Recomputed at most once per instance; a fresh instance is cheap to get. */
  private clusterCache: Video[][] | null = null;

  private constructor(
    private readonly catalog: VideoCatalog,
    private readonly state: StoredLibrary,
  ) {
    const removed = new Set(state.removedIds);
    const hidden = new Set(state.hiddenIds);

    this.catalogVideos = catalog.videos.filter(
      (video) => !removed.has(video.id),
    );
    this.videos = [...this.catalogVideos, ...state.customVideos];
    this.videoById = new Map(this.videos.map((video) => [video.id, video]));
    this.customIds = new Set(state.customVideos.map((video) => video.id));
    this.approvedVideos = [
      ...state.customVideos.filter((video) => video.status === "visible"),
      ...this.catalogVideos.filter((video) => !hidden.has(video.id)),
    ];
    this.approvedIds = new Set(this.approvedVideos.map((video) => video.id));
  }

  static from(catalog: VideoCatalog, state: StoredLibrary) {
    return new VideoLibrary(catalog, state);
  }

  static default(catalog: VideoCatalog) {
    return new VideoLibrary(catalog, {
      version: LIBRARY_VERSION,
      customVideos: [],
      removedIds: [],
      hiddenIds: [],
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

  /** Title signatures are re-read on every render; each is only worth one pass. */
  private signatureOf(video: Video) {
    const cached = signatureCache.get(video.id);
    if (cached) {
      return cached;
    }

    const signature = titleSignature(video.title);
    signatureCache.set(video.id, signature);
    return signature;
  }

  /**
   * The sidebar for one video: its series window (the previous episode, then
   * the next four, in order) if it has one, then a fully shuffled batch of
   * the library. A video with no series leads the list with the next
   * approved videos in order instead, so opening a recommendation advances
   * the visible list rather than only swapping the selected card with the
   * previous video.
   */
  recommendationGroupsFor(video: Video, salt: number): RecommendationGroup[] {
    const signature = this.signatureOf(video);
    const series: Video[] = [];
    const similar: Video[] = [];
    const rest: Video[] = [];

    for (const candidate of this.approvedVideos) {
      if (candidate.id === video.id) {
        continue;
      }

      const score = signatureSimilarity(
        signature,
        this.signatureOf(candidate),
      );

      if (isSameSeries(score)) {
        series.push(candidate);
      } else if (isSimilar(score)) {
        similar.push(candidate);
      } else {
        rest.push(candidate);
      }
    }

    if (series.length === 0) {
      const nextInOrder = this.nextApprovedVideos(video, SERIES_GROUP_SIZE);
      const nextInOrderIds = new Set(
        nextInOrder.map((candidate) => candidate.id),
      );
      const shuffled = shuffleWithSeed(
        [...similar, ...rest].filter(
          (candidate) => !nextInOrderIds.has(candidate.id),
        ),
        recommendationSalt(video, salt),
      ).slice(0, RECOMMENDED_GROUP_SIZE - nextInOrder.length);
      const recommendations = [...nextInOrder, ...shuffled];

      return recommendations.length > 0
        ? [{ key: "recommended", videos: recommendations }]
        : [];
    }

    const window = seriesWindow(series, video);
    const windowIds = new Set(window.map((candidate) => candidate.id));

    const leftover = [
      ...series.filter((candidate) => !windowIds.has(candidate.id)),
      ...similar,
      ...rest,
    ];

    const groups: RecommendationGroup[] = [
      { key: "series", videos: window },
      {
        key: "recommended",
        videos: shuffleWithSeed(leftover, recommendationSalt(video, salt)).slice(
          0,
          RECOMMENDED_GROUP_SIZE,
        ),
      },
    ];

    return groups.filter((group) => group.videos.length > 0);
  }

  private nextApprovedVideos(video: Video, count: number) {
    if (this.approvedVideos.length < 2) {
      return [];
    }

    const currentIndex = this.approvedVideos.findIndex(
      (candidate) => candidate.id === video.id,
    );
    const startIndex = currentIndex >= 0 ? currentIndex + 1 : 0;
    const next: Video[] = [];

    for (
      let offset = 0;
      offset < this.approvedVideos.length && next.length < count;
      offset += 1
    ) {
      const candidate =
        this.approvedVideos[(startIndex + offset) % this.approvedVideos.length];

      if (candidate.id !== video.id) {
        next.push(candidate);
      }
    }

    return next;
  }

  /** The same recommendations as one flat list, series first. */
  recommendationsFor(video: Video, salt: number) {
    return this.recommendationGroupsFor(video, salt).flatMap(
      (group) => group.videos,
    );
  }

  /** Approved videos bundled into series, each bundle in episode order. */
  private seriesClusters() {
    if (this.clusterCache) {
      return this.clusterCache;
    }

    const clusters: { signature: TitleSignature; videos: Video[] }[] = [];

    for (const video of this.approvedVideos) {
      const signature = this.signatureOf(video);
      const existing = clusters.find((cluster) =>
        isSameSeries(signatureSimilarity(cluster.signature, signature)),
      );

      if (existing) {
        existing.videos.push(video);
        continue;
      }

      clusters.push({ signature, videos: [video] });
    }

    const ordered = clusters.map((cluster) =>
      orderEpisodes(cluster.videos, null),
    );

    this.clusterCache = ordered;
    return ordered;
  }

  /**
   * The running order behind the next button: every approved video exactly
   * once, episodes of a series kept together and in order, the series
   * themselves shuffled by the session's salt.
   *
   * It is a ring, not a fresh guess per video. Picking "most related to what
   * is on screen" each time looks reasonable and behaves badly — relatedness
   * is symmetric, so two similar videos each name the other as next and the
   * viewer bounces between the same handful forever.
   */
  playbackOrder(salt: number) {
    if (this.playbackOrderCache?.salt === salt) {
      return this.playbackOrderCache.videos;
    }

    const videos = shuffleWithSeed(this.seriesClusters(), salt).flat();
    this.playbackOrderCache = { salt, videos };
    return videos;
  }

  /** The next video in that ring, wrapping round at the end. */
  nextAfter(video: Video, salt: number): Video | null {
    const order = this.playbackOrder(salt);
    if (order.length < 2) {
      return null;
    }

    const index = order.findIndex((candidate) => candidate.id === video.id);
    // Watching something that is no longer approved: start the ring over.
    return index < 0 ? order[0] : order[(index + 1) % order.length];
  }

  approve(id: string) {
    if (this.approvedIds.has(id)) {
      return this;
    }

    return this.customIds.has(id)
      ? this.withState({ customVideos: this.setCustomStatus(id, "visible") })
      : this.withState({
          hiddenIds: this.state.hiddenIds.filter(
            (hiddenId) => hiddenId !== id,
          ),
        });
  }

  hide(id: string) {
    return this.customIds.has(id)
      ? this.withState({ customVideos: this.setCustomStatus(id, "hidden") })
      : this.withState({ hiddenIds: unique([...this.state.hiddenIds, id]) });
  }

  approveAll() {
    return this.withState({
      hiddenIds: [],
      customVideos: this.state.customVideos.map((video) => ({
        ...video,
        status: "visible" as const,
      })),
    });
  }

  hideAll() {
    return this.withState({
      hiddenIds: this.catalogVideos.map((video) => video.id),
      customVideos: this.state.customVideos.map((video) => ({
        ...video,
        status: "hidden" as const,
      })),
    });
  }

  reset() {
    return VideoLibrary.default(this.catalog);
  }

  /**
   * Catalog videos cannot be deleted, only tombstoned, so a reset can bring
   * them back. Parent-added videos are dropped outright.
   */
  remove(video: Video) {
    if (video.source === "custom") {
      return this.withState({
        customVideos: this.state.customVideos.filter(
          (stored) => stored.id !== video.id,
        ),
      });
    }

    return this.withState({
      removedIds: unique([...this.state.removedIds, video.id]),
      hiddenIds: this.state.hiddenIds.filter((id) => id !== video.id),
    });
  }

  private setCustomStatus(id: string, status: CustomLibraryVideo["status"]) {
    return this.state.customVideos.map((video) =>
      video.id === id ? { ...video, status } : video,
    );
  }

  /** Adds parent-added videos, newest first, approving them by default. */
  addCustomVideos(videos: Video[], { approve = true } = {}) {
    const known = new Set(this.state.customVideos.map((v) => v.videoId));
    const fresh = videos.filter((video) => !known.has(video.videoId));

    if (fresh.length === 0) {
      return approve ? this.approveMany(videos.map((v) => v.id)) : this;
    }

    const status: CustomLibraryVideo["status"] = approve
      ? "visible"
      : "hidden";

    return this.withState({
      customVideos: [
        ...fresh.map((video) => ({ ...video, status })),
        ...this.state.customVideos,
      ],
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
    const idSet = new Set(ids.filter((id) => !removed.has(id)));

    return this.withState({
      hiddenIds: this.state.hiddenIds.filter((id) => !idSet.has(id)),
      customVideos: this.state.customVideos.map((video) =>
        idSet.has(video.id)
          ? { ...video, status: "visible" as const }
          : video,
      ),
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
