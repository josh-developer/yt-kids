"use client";

import {
  ChannelAvatar,
  useVideoLabels,
  type Video,
} from "@/entities/video";
import { SafeYouTubePlayer } from "@/widgets/player";
import { Recommendations } from "@/widgets/recommendations";

export function WatchPage({
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
  const labels = useVideoLabels();

  return (
    <div className="watch-layout">
      <article>
        <SafeYouTubePlayer
          isTvBrowser={isTvBrowser}
          nextVideo={nextVideo}
          previousVideo={previousVideo}
          video={video}
          onDurationResolved={onDurationResolved}
          onFullscreenChange={onFullscreenChange}
          onNextVideo={onNextVideo}
          onPreviousVideo={onPreviousVideo}
        />
        <h1 className="watch-title">{labels.title(video)}</h1>
        <div className="watch-bar">
          <div className="channel-line">
            <ChannelAvatar video={video} />
            <div>
              <strong>{labels.channel(video)}</strong>
              <div className="muted">{labels.views(video)}</div>
            </div>
          </div>
        </div>
      </article>

      <Recommendations videos={recommendations} onOpenVideo={onOpenVideo} />
    </div>
  );
}
