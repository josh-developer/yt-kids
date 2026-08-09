import type { Video } from "../model/types";
import { ChannelAvatar } from "./channel-avatar";
import { VideoSummary } from "./video-summary";
import { VideoThumbnail } from "./video-thumbnail";
import styles from "./video.module.css";

export function VideoCard({
  video,
  priority,
  onOpen,
}: {
  video: Video;
  priority?: "lcp" | "eager";
  onOpen: (video: Video) => void;
}) {
  return (
    <button className={styles.videoCard} type="button" onClick={() => onOpen(video)}>
      <VideoThumbnail video={video} priority={priority} />
      <div className={styles.videoMeta}>
        <ChannelAvatar video={video} />
        <VideoSummary video={video} />
      </div>
    </button>
  );
}
