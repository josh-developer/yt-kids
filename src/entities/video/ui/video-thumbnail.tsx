import { thumbnailUrl } from "@/shared/api/youtube";
import type { Video } from "../model/types";
import styles from "./video.module.css";

export function VideoThumbnail({ video }: { video: Video }) {
  return (
    <span className={styles.thumbnail}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        loading="lazy"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
        src={thumbnailUrl(video.videoId)}
      />
      <span className={styles.duration}>{video.duration}</span>
    </span>
  );
}
