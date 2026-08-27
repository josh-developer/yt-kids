import { Eye } from "lucide-react";
import { useVideoLabels } from "../model/use-video-labels";
import type { Video } from "../model/types";
import primitives from "@/shared/ui/primitives.module.css";
import styles from "./video.module.css";

/** Title / channel / views triple, shared by the grid and the sidebar. */
export function VideoSummary({
  className,
  video,
}: {
  className?: string;
  video: Video;
}) {
  const labels = useVideoLabels();
  const viewCount = labels.viewCount(video);

  return (
    <span className={[styles.videoSummary, className].filter(Boolean).join(" ")}>
      <span className={styles.videoTitle}>{labels.title(video)}</span>
      <span
        className={`${primitives.muted} ${styles.videoSubline} ${styles.videoMetaLine}`}
      >
        <span className={styles.videoChannel}>{labels.channel(video)}</span>
        {viewCount ? (
          <span className={styles.videoViewMetric} aria-label={labels.views(video)}>
            <Eye size={15} strokeWidth={2.5} aria-hidden="true" />
            <span>{viewCount}</span>
          </span>
        ) : (
          <span className={styles.videoViewSlot} aria-hidden="true" />
        )}
      </span>
    </span>
  );
}
