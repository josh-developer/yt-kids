import { VideoCard, type Video } from "@/entities/video";
import { VirtualGrid } from "@/shared/ui/virtual-grid";

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
      className="video-grid"
      getKey={(video) => video.id}
      renderItem={(video) => <VideoCard video={video} onOpen={onOpenVideo} />}
    />
  );
}
