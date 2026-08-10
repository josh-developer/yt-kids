import type { YouTubeMetadata } from "@/shared/api/youtube";
import type { Video } from "./types";

export const CUSTOM_VIDEO_ACCENT = "#00a676";
export const UNKNOWN_DURATION = "--:--";

/**
 * Single place a parent-added video is built. Missing metadata stays empty so
 * the UI can fill in a localized fallback instead of freezing one language
 * into storage.
 */
export function createCustomVideo(
  videoId: string,
  metadata: YouTubeMetadata = {},
): Video {
  return {
    id: customVideoId(videoId),
    videoId,
    title: metadata.title || "",
    channel: metadata.channel || "",
    duration: metadata.duration || UNKNOWN_DURATION,
    accent: CUSTOM_VIDEO_ACCENT,
    source: "custom",
  };
}

export function customVideoId(videoId: string) {
  return `custom-${videoId}`;
}

export function matchesQuery(video: Video, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }

  return `${video.title} ${video.channel}`.toLowerCase().includes(needle);
}
