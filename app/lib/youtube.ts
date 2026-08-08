import type { YouTubeMetadata, YouTubePlaylist } from "./types";

export function isTrustedYouTubeMessageOrigin(origin: string) {
  try {
    const hostname = new URL(origin).hostname;
    return (
      hostname === "youtube.com" ||
      hostname === "www.youtube.com" ||
      hostname === "m.youtube.com" ||
      hostname.endsWith(".youtube.com") ||
      hostname === "youtube-nocookie.com" ||
      hostname === "www.youtube-nocookie.com" ||
      hostname.endsWith(".youtube-nocookie.com")
    );
  } catch {
    return false;
  }
}

export function thumbnailUrl(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export function lockedEmbedUrl(videoId: string, shouldAutoplay = false) {
  const params = new URLSearchParams({
    autoplay: shouldAutoplay ? "1" : "0",
    controls: "0",
    disablekb: "1",
    enablejsapi: "1",
    fs: "0",
    iv_load_policy: "3",
    modestbranding: "1",
    playsinline: "1",
    rel: "0",
  });

  if (typeof window !== "undefined") {
    params.set("origin", window.location.origin);
  }

  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

export function formatTimestamp(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remainingSeconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      remainingSeconds,
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function parseDurationText(duration: string) {
  const parts = duration
    .trim()
    .split(":")
    .map((part) => Number(part));

  if (
    parts.length < 2 ||
    parts.length > 3 ||
    parts.some((part) => !Number.isFinite(part) || part < 0)
  ) {
    return 0;
  }

  return parts.reduce((total, part) => total * 60 + part, 0);
}

export function extractYouTubeId(input: string) {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (url.hostname.includes("youtu.be")) {
      return url.pathname.split("/").filter(Boolean)[0] ?? null;
    }

    if (url.searchParams.get("v")) {
      return url.searchParams.get("v");
    }

    const parts = url.pathname.split("/").filter(Boolean);
    const marker = parts.findIndex((part) =>
      ["embed", "shorts", "live"].includes(part),
    );
    return marker >= 0 ? parts[marker + 1] ?? null : null;
  } catch {
    return null;
  }
}

export function extractYouTubePlaylistId(input: string) {
  try {
    const url = new URL(input.trim());
    const playlistId = url.searchParams.get("list");
    const hasVideoId = Boolean(url.searchParams.get("v"));
    return playlistId && (!hasVideoId || url.pathname.includes("playlist"))
      ? playlistId
      : null;
  } catch {
    return null;
  }
}

export async function fetchYouTubeMetadata(
  url: string,
): Promise<YouTubeMetadata> {
  try {
    const response = await fetch(
      `/api/youtube/oembed?url=${encodeURIComponent(url)}`,
    );

    if (!response.ok) {
      return {};
    }

    return (await response.json()) as YouTubeMetadata;
  } catch {
    return {};
  }
}

export async function fetchYouTubePlaylist(
  url: string,
): Promise<YouTubePlaylist> {
  try {
    const response = await fetch(
      `/api/youtube/playlist?url=${encodeURIComponent(url)}`,
    );

    if (!response.ok) {
      return {};
    }

    return (await response.json()) as YouTubePlaylist;
  } catch {
    return {};
  }
}
