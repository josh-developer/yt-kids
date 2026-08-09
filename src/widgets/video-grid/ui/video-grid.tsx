"use client";

import { VideoCard, type Video } from "@/entities/video";

export function VideoGrid({
  videos,
  onOpenVideo,
}: {
  videos: Video[];
  onOpenVideo: (video: Video) => void;
}) {
  return (
    <div className="video-grid">
      {videos.map((video) => (
        <VideoCard key={video.id} video={video} onOpen={onOpenVideo} />
      ))}
    </div>
  );
}
