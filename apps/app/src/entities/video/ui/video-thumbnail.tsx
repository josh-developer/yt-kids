import { thumbnailSrcSet, thumbnailUrl } from "@/shared/api/youtube";
import type { Video } from "../model/types";
import styles from "./video.module.css";

/**
 * Matches the home grid's breakpoints in `video-grid.module.css`: one column
 * under 720px, roughly two up to 1080px, then its 420px-minimum columns
 * scaling with viewport width beyond that. It's the default because the home
 * grid is the highest-traffic, scroll-heaviest consumer; other layouts (a
 * fixed-width sidebar row, say) pass their own actual slot width instead.
 */
const GRID_SIZES = "(max-width: 720px) 100vw, (max-width: 1080px) 50vw, 33vw";

export function VideoThumbnail({
  video,
  priority,
  sizes = GRID_SIZES,
}: {
  video: Video;
  /**
   * Cards that start above the fold load eagerly: a lazy image cannot be found
   * by the preload scanner, so it waits for layout, which is what delays the
   * largest paint. Exactly one card is marked `lcp` — the likely largest paint
   * — because a high priority shared by several images is no priority at all.
   */
  priority?: "lcp" | "eager";
  /**
   * The rendered width as an HTML `sizes` string, so the browser can pick a
   * `srcset` candidate close to the actual slot instead of always decoding
   * the largest cached rendition.
   */
  sizes?: string;
}) {
  return (
    <span className={styles.thumbnail}>
      {/*
       * A CSS background, not an `<img>`: every card on screen shares one
       * already-decoded bitmap this way, instead of each mounting its own
       * decode of the mark — the opposite of the oversized-thumbnail cost
       * this component exists to avoid. It sits behind the real thumbnail
       * and needs no load-state wiring: the opaque `<img>` covers it once
       * loaded, and it shows through again if that image errors out.
       */}
      <span className={styles.thumbnailPlaceholder} aria-hidden="true">
        <span className={styles.placeholderMark} />
        <span className={styles.placeholderLabel}>KidTube</span>
      </span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority === "lcp" ? "high" : undefined}
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
        src={thumbnailUrl(video.videoId)}
        srcSet={thumbnailSrcSet(video.videoId)}
        sizes={sizes}
      />
      <span className={styles.duration}>{video.duration}</span>
    </span>
  );
}
