import { useMemo, useRef } from "react";
import type { RecommendationGroup } from "@/entities/library";
import {
  ChannelAvatar,
  useVideoLabels,
  type Video,
} from "@/entities/video";
import { Recommendations } from "@/widgets/recommendations";
import { SafeYouTubePlayer } from "@/widgets/player";
import { PlaybackPositions } from "@/shared/lib/playback/playback-positions";
import primitives from "@/shared/ui/primitives.module.css";
import styles from "./watch-page.module.css";

export function WatchPage({
  isTvBrowser,
  nextVideo,
  previousVideo,
  recommendationGroups,
  recommendationKey,
  showRecommendations,
  video,
  onDurationResolved,
  onFullscreenChange,
  onNextVideo,
  onOpenVideo,
  onPreviousVideo,
  onToggleRecommendations,
}: {
  isTvBrowser: boolean;
  nextVideo: Video | null;
  previousVideo: Video | null;
  recommendationGroups: RecommendationGroup[];
  recommendationKey: string;
  showRecommendations: boolean;
  video: Video;
  onDurationResolved: (video: Video, seconds: number) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  onNextVideo: () => void;
  onOpenVideo: (video: Video) => void;
  onPreviousVideo: () => void;
  onToggleRecommendations: () => void;
}) {
  const labels = useVideoLabels();
  const positions = useMemo(() => new PlaybackPositions(), []);
  const durationRef = useRef(0);

  // Read once per video: reading it on every render would keep moving the
  // resume point as the video plays.
  const startTime = useMemo(
    () => positions.read(video.videoId),
    [positions, video.videoId],
  );

  return (
    <div className={styles.watchLayout}>
      <article className={styles.videoColumn}>
        <SafeYouTubePlayer
          isTvBrowser={isTvBrowser}
          nextVideo={nextVideo}
          previousVideo={previousVideo}
          video={video}
          startTime={startTime}
          onTimeUpdate={(seconds) =>
            positions.save(video.videoId, seconds, durationRef.current)
          }
          onDurationResolved={(resolvedVideo, seconds) => {
            durationRef.current = seconds;
            onDurationResolved(resolvedVideo, seconds);
          }}
          onFullscreenChange={onFullscreenChange}
          onNextVideo={onNextVideo}
          onPreviousVideo={onPreviousVideo}
        />
        <h1 className={styles.watchTitle}>{labels.title(video)}</h1>
        <div className={styles.watchBar}>
          <div className={styles.channelLine}>
            <ChannelAvatar video={video} />
            <div>
              <strong>{labels.channel(video)}</strong>
              <div className={primitives.muted}>{labels.views(video)}</div>
            </div>
          </div>
        </div>
      </article>

      <Recommendations
        key={recommendationKey}
        groups={recommendationGroups}
        isEnabled={showRecommendations}
        onOpenVideo={onOpenVideo}
        onToggle={onToggleRecommendations}
      />
    </div>
  );
}
