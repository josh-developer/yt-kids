import { VideoCard, type Video } from "@/entities/video";
import { VirtualGrid } from "@/shared/ui/virtual-grid";
import styles from "./video-grid.module.css";

export function VideoGrid({
  videos,
  onOpenVideo,
}: {
  videos: Video[];
  onOpenVideo: (video: Video) => void;
}) {
  return (
    <VirtualGrid
      items={videos}
      className={styles.videoGrid}
      getKey={(video) => video.id}
      renderItem={(video) => <VideoCard video={video} onOpen={onOpenVideo} />}
    />
  );
}
