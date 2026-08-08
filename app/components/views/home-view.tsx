"use client";

import { Plus } from "lucide-react";
import type { CopyText } from "../../lib/copy";
import type { Video } from "../../lib/types";
import { VideoCard } from "../video-card";

export function HomeView({
  copy,
  videos,
  onOpenVideo,
  onSettings,
}: {
  copy: CopyText;
  videos: Video[];
  onOpenVideo: (video: Video) => void;
  onSettings: () => void;
}) {
  if (videos.length === 0) {
    return (
      <div className="empty-state">
        <div>
          <h2>{copy.noApprovedVideos}</h2>
          <p className="muted">{copy.addVideosFromSettings}</p>
          <button
            className="primary-button"
            type="button"
            onClick={onSettings}
            data-tooltip={copy.openSettings}
          >
            <Plus size={18} />
            {copy.openSettings}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="video-grid">
      {videos.map((video) => (
        <VideoCard
          key={video.id}
          video={video}
          onOpen={onOpenVideo}
        />
      ))}
    </div>
  );
}
