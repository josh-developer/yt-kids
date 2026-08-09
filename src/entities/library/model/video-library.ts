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
import type { RecommendationGroup, StoredLibrary } from "./types";
import type { VideoCatalog } from "./video-catalog";

/**
 * A title's signature never changes, and a library value is replaced on every
 * edit — approving a video, backfilling a duration. Keeping these outside the
 * instance is what stops each edit from re-deriving all of it.
 */
const signatureCache = new Map<string, TitleSignature>();
/** Keyed by the `selectedIds` array itself, which `withState` reuses. */
const clusterCache = new WeakMap<readonly string[], Video[][]>();

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
  private playbackOrderCache: { salt: number; videos: Video[] } | null = null;

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
   * The sidebar for one video, split into the rest of its series, videos with
   * related titles, and the remaining library shuffled. Only the last group is
   * randomised: an episode list that reshuffled on every video would be
   * useless for watching a serial in order.
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

    const groups: RecommendationGroup[] = [
      {
        key: "series",
        videos: orderEpisodes(series, episodeNumberOf(video.title)),
      },
      { key: "similar", videos: similar },
      { key: "more", videos: shuffleWithSeed(rest, salt + video.id.length) },
    ];

    return groups.filter((group) => group.videos.length > 0);
  }

  /** The same recommendations as one flat list, series first. */
  recommendationsFor(video: Video, salt: number) {
    return this.recommendationGroupsFor(video, salt).flatMap(
      (group) => group.videos,
    );
  }

  /** Approved videos bundled into series, each bundle in episode order. */
  private seriesClusters() {
    const cached = clusterCache.get(this.state.selectedIds);
    if (cached) {
      return cached;
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

    clusterCache.set(this.state.selectedIds, ordered);
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
