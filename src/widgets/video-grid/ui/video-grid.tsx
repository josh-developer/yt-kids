import { VideoCard, type Video } from "@/entities/video";
import { VirtualGrid } from "@/shared/ui/virtual-grid";

/** Roughly a first screen on the widest layout; the rest stay lazy. */
const EAGER_CARDS = 4;
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
      renderItem={(video, index) => (
        <VideoCard
          video={video}
          priority={index === 0 ? "lcp" : index < EAGER_CARDS ? "eager" : undefined}
          onOpen={onOpenVideo}
        />
      )}
    />
  );
}
