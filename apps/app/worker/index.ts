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

/** The two YouTube renditions, paired with their real pixel widths. */
const THUMBNAIL_SOURCES = {
  card: { file: "mqdefault", width: 320 },
  poster: { file: "hqdefault", width: 480 },
} as const;

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
    `${new URL(request.url).origin}/_thumb/${videoId}/${size}.${extension}`,
  );
  const edgeCache = typeof caches === "undefined" ? undefined : caches.default;

  const hit = await edgeCache?.match(cacheKey);
  if (hit) {
    return hit;
  }

  const { file, width } = THUMBNAIL_SOURCES[size];
  const source = await fetch(`https://i.ytimg.com/vi/${videoId}/${file}.jpg`);
  if (!source.ok) {
    return new Response("Thumbnail not found", { status: 404 });
  }

  const { body, contentType } = await transcodeThumbnail(
    env.IMAGES,
    await source.arrayBuffer(),
    width,
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

    return handler.fetch(request, env, ctx);
  },
};

export default worker;
