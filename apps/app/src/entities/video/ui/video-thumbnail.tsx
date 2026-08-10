import { thumbnailUrl } from "@/shared/api/youtube";
import type { Video } from "../model/types";
import styles from "./video.module.css";

export function VideoThumbnail({
  video,
  priority,
}: {
  video: Video;
  /**
   * Cards that start above the fold load eagerly: a lazy image cannot be found
   * by the preload scanner, so it waits for layout, which is what delays the
   * largest paint. Exactly one card is marked `lcp` — the likely largest paint
   * — because a high priority shared by several images is no priority at all.
   */
  priority?: "lcp" | "eager";
}) {
  return (
    <span className={styles.thumbnail}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority === "lcp" ? "high" : undefined}
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
        src={thumbnailUrl(video.videoId)}
      />
      <span className={styles.duration}>{video.duration}</span>
    </span>
  );
}
