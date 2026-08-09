export type YouTubeMetadata = {
  title?: string;
  channel?: string;
  duration?: string;
  durationSeconds?: number;
};

/**
 * The seam every consumer depends on. Callers take this interface, not the
 * HTTP implementation, so importing can be exercised without a network.
 */
export interface YouTubeApi {
  fetchMetadata(url: string): Promise<YouTubeMetadata>;
  fetchPlaylistVideoIds(url: string): Promise<string[]>;
}

/** Talks to this app's own `/api/youtube/*` routes, never to YouTube directly. */
export class HttpYouTubeApi implements YouTubeApi {
  async fetchMetadata(url: string): Promise<YouTubeMetadata> {
    return (await this.getJson<YouTubeMetadata>("/api/youtube/oembed", url)) ?? {};
  }

  async fetchPlaylistVideoIds(url: string): Promise<string[]> {
    const playlist = await this.getJson<{ videoIds?: string[] }>(
      "/api/youtube/playlist",
      url,
    );
    return playlist?.videoIds ?? [];
  }

  private async getJson<Result>(endpoint: string, url: string) {
    try {
      const response = await fetch(
        `${endpoint}?url=${encodeURIComponent(url)}`,
      );
      return response.ok ? ((await response.json()) as Result) : null;
    } catch {
      // Offline or blocked: callers fall back to the data they already have.
      return null;
    }
  }
}

export const youTubeApi: YouTubeApi = new HttpYouTubeApi();
