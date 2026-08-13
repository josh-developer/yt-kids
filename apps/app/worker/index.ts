/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

type ImagesBinding = {
  input(stream: ReadableStream): {
    transform(options: Record<string, unknown>): {
      output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
    };
  };
};

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** "production", "test", or "development"; set per environment in wrangler.jsonc. */
  APP_ENV?: string;
  /**
   * Present only once Images transformations are enabled for the account.
   * Every caller degrades to the untransformed source without it.
   */
  IMAGES?: ImagesBinding;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

/**
 * Re-serving YouTube thumbnails from our own origin.
 *
 * `i.ytimg.com` sends every thumbnail with a two-hour cache lifetime, so a
 * child who opens the app twice in an afternoon downloads the whole grid
 * twice, and the largest paint — a thumbnail — waits on a DNS lookup and a TLS
 * handshake to a third origin before its first byte. Proxying makes the grid
 * same-origin on an already-warm connection, cacheable for a month, and, where
 * the Images binding exists, AVIF or WebP instead of JPEG.
 */
const THUMBNAIL_ROUTE = /^\/_thumb\/([\w-]{11})\/(card|poster)$/;

/**
 * The source renditions to try, in quality order, and the width we keep after
 * transcoding. `maxresdefault` and `hq720` are the clean 16:9 sources when an
 * upload has them; older videos often do not, so the worker falls back until it
 * reaches the always-present card-sized thumbnail.
 */
const THUMBNAIL_SOURCES = {
  card: {
    width: 960,
    sources: [
      { file: "maxresdefault", width: 1280 },
      { file: "hq720", width: 1280 },
      { file: "sddefault", width: 640 },
      { file: "hqdefault", width: 480 },
      { file: "mqdefault", width: 320 },
    ],
  },
  poster: {
    width: 1280,
    sources: [
      { file: "maxresdefault", width: 1280 },
      { file: "hq720", width: 1280 },
      { file: "sddefault", width: 640 },
      { file: "hqdefault", width: 480 },
    ],
  },
} as const;

/** Bumps both browser URLs and edge-cache keys when thumbnail generation changes. */
const THUMBNAIL_CACHE_VERSION = "v2";

/**
 * An uploader can swap a thumbnail, so these URLs are long-lived rather than
 * immutable. A month satisfies the cache-lifetime audit and is far longer than
 * any session.
 */
const THUMBNAIL_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/** Roughly the quality where AVIF stops being distinguishable at card size. */
const THUMBNAIL_QUALITY = 70;

function negotiateThumbnailFormat(accept: string) {
  if (accept.includes("image/avif")) {
    return "image/avif";
  }

  if (accept.includes("image/webp")) {
    return "image/webp";
  }

  return "image/jpeg";
}

/**
 * Transcodes when it can and returns the original JPEG when it cannot. The
 * source is buffered first because a transform that fails halfway has already
 * drained the stream, and a slower image beats a broken one.
 */
async function transcodeThumbnail(
  images: ImagesBinding | undefined,
  source: ArrayBuffer,
  width: number,
  format: string,
) {
  const original = { body: source as BodyInit, contentType: "image/jpeg" };

  if (!images || format === "image/jpeg") {
    return original;
  }

  try {
    const input = new Response(source).body;
    if (!input) {
      return original;
    }

    const result = await images
      .input(input)
      .transform({ width })
      .output({ format, quality: THUMBNAIL_QUALITY });
    const transformed = result.response();
    const body = await transformed.arrayBuffer();

    return {
      body: body as BodyInit,
      contentType: transformed.headers.get("Content-Type") ?? format,
    };
  } catch {
    return original;
  }
}

async function fetchThumbnailSource(
  videoId: string,
  sources: (typeof THUMBNAIL_SOURCES)[keyof typeof THUMBNAIL_SOURCES],
) {
  for (const source of sources.sources) {
    const response = await fetch(
      `https://i.ytimg.com/vi/${videoId}/${source.file}.jpg`,
    );

    if (response.ok) {
      return {
        response,
        width: Math.min(sources.width, source.width),
      };
    }
  }

  return null;
}

async function serveThumbnail(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
  videoId: string,
  size: keyof typeof THUMBNAIL_SOURCES,
): Promise<Response> {
  const format = negotiateThumbnailFormat(request.headers.get("accept") ?? "");

  // `Vary: Accept` cannot be the cache dimension here: Accept strings differ
  // between browser builds, so the cache would fragment per client. The
  // negotiated format goes into the key instead.
  const extension = format.slice("image/".length);
  const cacheKey = new Request(
    `${new URL(request.url).origin}/_thumb/${videoId}/${size}.${extension}?${THUMBNAIL_CACHE_VERSION}`,
  );
  const edgeCache = typeof caches === "undefined" ? undefined : caches.default;

  const hit = await edgeCache?.match(cacheKey);
  if (hit) {
    return hit;
  }

  const source = await fetchThumbnailSource(videoId, THUMBNAIL_SOURCES[size]);
  if (!source) {
    return new Response("Thumbnail not found", { status: 404 });
  }

  const { body, contentType } = await transcodeThumbnail(
    env.IMAGES,
    await source.response.arrayBuffer(),
    source.width,
    format,
  );

  const response = new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": `public, max-age=${THUMBNAIL_MAX_AGE_SECONDS}`,
      "X-Content-Type-Options": "nosniff",
    },
  });

  if (edgeCache) {
    ctx.waitUntil(edgeCache.put(cacheKey, response.clone()));
  }

  return response;
}

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const thumbnail = THUMBNAIL_ROUTE.exec(url.pathname);
    if (thumbnail) {
      const [, videoId, size] = thumbnail;
      return serveThumbnail(
        request,
        env,
        ctx,
        videoId,
        size as keyof typeof THUMBNAIL_SOURCES,
      );
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      const images = env.IMAGES;
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: images && (async (body, { width, format, quality }) => {
          const result = await images.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        }),
      }, allowedWidths);
    }

    const response = await handler.fetch(request, env, ctx);

    // Staging serves the same pages as production, on more than one hostname
    // (test.kidtube.uz and the workers.dev URL). Keying off APP_ENV rather
    // than the hostname keeps every one of them out of search results.
    if (env.APP_ENV !== "production") {
      const staged = new Response(response.body, response);
      staged.headers.set("X-Robots-Tag", "noindex, nofollow");
      return staged;
    }

    return response;
  },
};

export default worker;
