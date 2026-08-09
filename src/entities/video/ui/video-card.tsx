import type { Video } from "../model/types";
import { ChannelAvatar } from "./channel-avatar";
import { VideoSummary } from "./video-summary";
import { VideoThumbnail } from "./video-thumbnail";

export function VideoCard({
  video,
  onOpen,
}: {
  video: Video;
  onOpen: (video: Video) => void;
}) {
  return (
    <button className="video-card" type="button" onClick={() => onOpen(video)}>
      <VideoThumbnail video={video} />
      <div className="video-meta">
        <ChannelAvatar video={video} />
        <VideoSummary video={video} />
      </div>
    </button>
  );
}
