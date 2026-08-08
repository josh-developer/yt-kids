"use client";

import type { Video } from "../lib/types";
import { Thumbnail } from "./ui/thumbnail";

export function VideoCard({
  video,
  onOpen,
}: {
  video: Video;
  onOpen: (video: Video) => void;
}) {
  return (
    <button
      className="video-card"
      type="button"
      onClick={() => onOpen(video)}
    >
      <Thumbnail video={video} />
      <div className="video-meta">
        <span className="avatar" style={{ "--avatar": video.accent }}>
          {video.channel.slice(0, 1)}
        </span>
        <span>
          <span className="video-title">{video.title}</span>
          <span className="video-subline">{video.channel}</span>
          <span className="video-subline">{video.views}</span>
        </span>
      </div>
    </button>
  );
}
