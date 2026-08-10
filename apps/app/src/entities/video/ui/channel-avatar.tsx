import { useVideoLabels } from "../model/use-video-labels";
import type { Video } from "../model/types";
import styles from "./video.module.css";

export function ChannelAvatar({ video }: { video: Video }) {
  const labels = useVideoLabels();

  return (
    <span className={styles.avatar} style={{ "--avatar": video.accent }}>
      {labels.channel(video).slice(0, 1)}
    </span>
  );
}
