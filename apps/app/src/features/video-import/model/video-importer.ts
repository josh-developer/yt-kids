import { PLAYLIST_IMPORT_CHUNK_SIZE } from "@/shared/config/app-config";
import { unique } from "@/shared/lib/collections";
import {
  extractYouTubeId,
  extractYouTubePlaylistId,
  isVideoId,
  watchUrl,
  type YouTubeApi,
} from "@/shared/api/youtube";
import { createCustomVideo, type Video } from "@/entities/video";
import type { VideoLibrary } from "@/entities/library";

export type ImportProgress = { done: number; total: number };

/** What the paste box produced. The UI decides how to phrase each case. */
export type ImportOutcome =
  | { kind: "invalid-link" }
  | { kind: "already-in-library"; video: Video }
  | { kind: "video"; video: Video }
  | { kind: "playlist"; playlistVideoIds: string[]; videos: Video[] }
  | { kind: "empty-playlist" };

/**
 * Turns a pasted YouTube link into videos. Depends on the `YouTubeApi`
 * interface, so it can be driven with a stub in tests.
 */
export class VideoImporter {
  constructor(
    private readonly api: YouTubeApi,
    private readonly chunkSize: number = PLAYLIST_IMPORT_CHUNK_SIZE,
  ) {}

  async import(
    input: string,
    library: VideoLibrary,
    onProgress: (progress: ImportProgress) => void = () => {},
  ): Promise<ImportOutcome> {
    return extractYouTubePlaylistId(input)
      ? this.importPlaylist(input, library, onProgress)
      : this.importVideo(input, library);
  }

  private async importVideo(
    input: string,
    library: VideoLibrary,
  ): Promise<ImportOutcome> {
    const videoId = extractYouTubeId(input);
    if (!videoId || !isVideoId(videoId)) {
      return { kind: "invalid-link" };
    }

    const existing = library.findByVideoId(videoId);
    if (existing) {
      return { kind: "already-in-library", video: existing };
    }

    const metadata = await this.api.fetchMetadata(watchUrl(videoId));
    return { kind: "video", video: createCustomVideo(videoId, metadata) };
  }

  private async importPlaylist(
    input: string,
    library: VideoLibrary,
    onProgress: (progress: ImportProgress) => void,
  ): Promise<ImportOutcome> {
    const playlistVideoIds = unique(
      (await this.api.fetchPlaylistVideoIds(input)).filter(isVideoId),
    );

    if (playlistVideoIds.length === 0) {
      return { kind: "empty-playlist" };
    }

    const known = new Set(library.videos.map((video) => video.videoId));
    const missing = playlistVideoIds.filter((videoId) => !known.has(videoId));
    const videos = await this.fetchVideos(missing, onProgress);

    return { kind: "playlist", playlistVideoIds, videos };
  }

  /** Fetched in chunks so a long playlist does not open hundreds of requests. */
  private async fetchVideos(
    videoIds: string[],
    onProgress: (progress: ImportProgress) => void,
  ) {
    const videos: Video[] = [];

    for (let index = 0; index < videoIds.length; index += this.chunkSize) {
      const chunk = videoIds.slice(index, index + this.chunkSize);
      onProgress({
        done: Math.min(index + chunk.length, videoIds.length),
        total: videoIds.length,
      });

      videos.push(
        ...(await Promise.all(
          chunk.map(async (videoId) =>
            createCustomVideo(
              videoId,
              await this.api.fetchMetadata(watchUrl(videoId)),
            ),
          ),
        )),
      );
    }

    return videos;
  }
}
