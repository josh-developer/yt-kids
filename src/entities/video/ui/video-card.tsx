import type { Video } from "../model/types";
import { ChannelAvatar } from "./channel-avatar";
import { VideoSummary } from "./video-summary";
import { VideoThumbnail } from "./video-thumbnail";
import styles from "./video.module.css";

export function VideoCard({
  video,
  onOpen,
}: {
  video: Video;
  onOpen: (video: Video) => void;
}) {
  return (
    <button className={styles.videoCard} type="button" onClick={() => onOpen(video)}>
      <VideoThumbnail video={video} />
      <div className={styles.videoMeta}>
        <ChannelAvatar video={video} />
        <VideoSummary video={video} />
      </div>
    </button>
  );
}
