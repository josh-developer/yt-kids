const YOUTUBE_HOSTS = ["youtube.com", "youtube-nocookie.com"];

export function isTrustedYouTubeMessageOrigin(origin: string) {
  try {
    const { hostname } = new URL(origin);
    return YOUTUBE_HOSTS.some(
      (host) => hostname === host || hostname.endsWith(`.${host}`),
    );
  } catch {
    return false;
  }
}

export type ThumbnailSize = "card" | "poster";

/** Must match `THUMBNAIL_CACHE_VERSION` in `apps/app/worker/index.ts`. */
const THUMBNAIL_VERSION = "v2";

/** Must match `THUMBNAIL_WIDTHS` in `apps/app/worker/index.ts`. */
export const THUMBNAIL_WIDTHS = [320, 480, 640, 960] as const;

/**
 * Same-origin on purpose. `i.ytimg.com` caches thumbnails for two hours and
 * lives behind its own DNS lookup and TLS handshake, which the largest paint on
 * the home screen has to wait through. The worker re-serves the same image with
 * a month-long lifetime, in AVIF or WebP where the browser accepts it. The
 * route shape is mirrored by `THUMBNAIL_ROUTE` in `worker/index.ts`.
 */
export function thumbnailUrl(videoId: string, size: ThumbnailSize = "card", width?: number) {
  const params = new URLSearchParams({ v: THUMBNAIL_VERSION });
  if (width) {
    params.set("w", String(width));
  }
  return `/_thumb/${videoId}/${size}?${params.toString()}`;
}

/**
 * A `srcset` covering every cached width, so the browser picks a candidate
 * from the rendered slot size and device pixel ratio instead of the worker
 * always serving its largest rendition to a 128px sidebar thumbnail.
 */
export function thumbnailSrcSet(videoId: string, size: ThumbnailSize = "card") {
  return THUMBNAIL_WIDTHS.map(
    (width) => `${thumbnailUrl(videoId, size, width)} ${width}w`,
  ).join(", ");
}

export function watchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Embed URL with every YouTube affordance a kid could wander off through
 * (controls, keyboard, related videos, branding) switched off.
 */
export function lockedEmbedUrl(
  videoId: string,
  {
    shouldAutoplay = false,
    shouldStartMuted = false,
    startSeconds = 0,
  }: {
    shouldAutoplay?: boolean;
    /**
     * Carried in the URL so autoplay is accepted everywhere. A later unmute is
     * sent as a command, keeping the already-buffered iframe alive.
     */
    shouldStartMuted?: boolean;
    /** Where to pick playback up, for an embed retried mid-video. */
    startSeconds?: number;
  } = {},
) {
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
    // Some uploads default their captions on. Captions are the viewer's
    // choice here, made through the player's own button.
    cc_load_policy: "0",
  });

  if (shouldStartMuted) {
    params.set("mute", "1");
  }

  if (startSeconds > 0) {
    params.set("start", String(Math.floor(startSeconds)));
  }

  if (typeof window !== "undefined") {
    params.set("origin", window.location.origin);
  }

  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

export const VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;

export function isVideoId(value: string) {
  return VIDEO_ID_PATTERN.test(value);
}

export function extractYouTubeId(input: string) {
  const trimmed = input.trim();
  if (isVideoId(trimmed)) {
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
