import { thumbnailUrl } from "./youtube-urls";

/**
 * Warming a video before it is asked for.
 *
 * Starting an embed costs a DNS lookup, a TLS handshake and two documents
 * before a single frame arrives. None of that depends on the viewer having
 * decided yet — so when the next video becomes *likely* (a pointer resting on
 * the next button, an autoplay countdown running) the connections and the
 * poster are fetched ahead of the click.
 *
 * Everything here is best-effort and idempotent: a browser that ignores a hint
 * simply pays the cost later, exactly as it does today.
 */

/**
 * Only what an embed really contacts. `www.youtube.com`, the font host and
 * `i.ytimg.com` are deliberately absent: the embed is served from the nocookie
 * domain, thumbnails now come from our own origin, and a preconnect that goes
 * unused holds a socket open for nothing — which is what an audit reports
 * against you.
 */
const MEDIA_ORIGINS = ["https://www.youtube-nocookie.com"];

const warmedVideoIds = new Set<string>();
let hasWarmedOrigins = false;

function addLink(rel: string, href: string, extra: Partial<HTMLLinkElement> = {}) {
  if (document.head.querySelector(`link[rel="${rel}"][href="${href}"]`)) {
    return;
  }

  const link = document.createElement("link");
  link.rel = rel;
  link.href = href;
  Object.assign(link, extra);
  document.head.append(link);
}

/** Opens the connections every embed needs, once per page. */
export function warmYouTubeOrigins() {
  if (hasWarmedOrigins || typeof document === "undefined") {
    return;
  }

  hasWarmedOrigins = true;
  for (const origin of MEDIA_ORIGINS) {
    addLink("dns-prefetch", origin);
    addLink("preconnect", origin, { crossOrigin: "anonymous" });
  }
}

/**
 * Pulls what is knowable about one video into the browser's caches: the
 * connections its embed will need and the poster the next screen opens with.
 * Repeat calls for the same video do nothing.
 */
export function prefetchVideo(videoId: string) {
  if (typeof document === "undefined" || warmedVideoIds.has(videoId)) {
    return;
  }

  warmedVideoIds.add(videoId);
  warmYouTubeOrigins();

  // The poster is the first thing the viewer sees on the next screen.
  const poster = new Image();
  poster.decoding = "async";
  poster.src = thumbnailUrl(videoId);
}
