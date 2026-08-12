import { SITE_URL } from "../../config";

export type ThumbnailSize = "card" | "poster";

/**
 * Thumbnails come through the site's own proxy, not from `i.ytimg.com`.
 *
 * That endpoint exists because YouTube serves thumbnails with a two-hour cache
 * lifetime; it re-serves them with a month-long one and negotiates AVIF or WebP
 * from the `Accept` header. Verified against production: a request advertising
 * AVIF gets `image/avif` at 11.6KB where the JPEG is about 24KB, with
 * `cache-control: public, max-age=2592000`.
 *
 * So this is not merely "the same URL the web uses" — it is a third of the bytes
 * per card and a cache that survives a month, both of which matter more on a
 * phone than in a browser. Mirrors `thumbnailUrl` in the web app's
 * `youtube-urls.ts`; the route shape is defined by `THUMBNAIL_ROUTE` in
 * `apps/app/worker/index.ts`.
 */
export function thumbnailUrl(videoId: string, size: ThumbnailSize = "card") {
  return `${SITE_URL}/_thumb/${videoId}/${size}`;
}
