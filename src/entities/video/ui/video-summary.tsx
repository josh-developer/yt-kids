import { useVideoLabels } from "../model/use-video-labels";
import type { Video } from "../model/types";
import primitives from "@/shared/ui/primitives.module.css";
import styles from "./video.module.css";

/** Title / channel / views triple, shared by the grid and the sidebar. */
export function VideoSummary({ video }: { video: Video }) {
  const labels = useVideoLabels();

  return (
    <span>
      <span className={styles.videoTitle}>{labels.title(video)}</span>
      <span className={`${primitives.muted} ${styles.videoSubline}`}>{labels.channel(video)}</span>
      <span className={`${primitives.muted} ${styles.videoSubline}`}>{labels.views(video)}</span>
    </span>
  );
}
