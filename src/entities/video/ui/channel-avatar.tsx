import { useVideoLabels } from "../model/use-video-labels";
import type { Video } from "../model/types";

export function ChannelAvatar({ video }: { video: Video }) {
  const labels = useVideoLabels();

  return (
    <span className="avatar" style={{ "--avatar": video.accent }}>
      {labels.channel(video).slice(0, 1)}
    </span>
  );
}
