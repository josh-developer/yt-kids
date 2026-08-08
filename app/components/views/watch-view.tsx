"use client";

import type { CopyText } from "../../lib/copy";
import type { Video } from "../../lib/types";
import { SafeYouTubePlayer } from "../player/safe-youtube-player";
import { Thumbnail } from "../ui/thumbnail";

export function WatchView({
  copy,
  isTvBrowser,
  nextVideo,
  previousVideo,
  recommendations,
  video,
  onDurationResolved,
  onFullscreenChange,
  onNextVideo,
  onOpenVideo,
  onPreviousVideo,
}: {
  copy: CopyText;
  isTvBrowser: boolean;
  nextVideo: Video | null;
  previousVideo: Video | null;
  recommendations: Video[];
  video: Video;
  onDurationResolved: (video: Video, seconds: number) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  onNextVideo: () => void;
  onOpenVideo: (video: Video) => void;
  onPreviousVideo: () => void;
}) {
  return (
    <div className="watch-layout">
      <article>
        <SafeYouTubePlayer
          copy={copy}
          isTvBrowser={isTvBrowser}
          nextVideo={nextVideo}
          previousVideo={previousVideo}
          video={video}
          onDurationResolved={onDurationResolved}
          onFullscreenChange={onFullscreenChange}
          onNextVideo={onNextVideo}
          onPreviousVideo={onPreviousVideo}
        />
        <h1 className="watch-title">{video.title}</h1>
        <div className="watch-bar">
          <div className="channel-line">
            <span className="avatar" style={{ "--avatar": video.accent }}>
              {video.channel.slice(0, 1)}
            </span>
            <div>
              <strong>{video.channel}</strong>
              <div className="muted">{video.views}</div>
            </div>
          </div>
        </div>
      </article>

      <aside className="recommendations" aria-label={copy.playRecommendedVideo}>
        {recommendations.map((item) => (
          <button
            className="recommendation-card"
            key={item.id}
            type="button"
            onClick={() => onOpenVideo(item)}
          >
            <Thumbnail video={item} />
            <span>
              <span className="video-title">{item.title}</span>
              <span className="video-subline">{item.channel}</span>
              <span className="video-subline">{item.views}</span>
            </span>
          </button>
        ))}
      </aside>
    </div>
  );
}
