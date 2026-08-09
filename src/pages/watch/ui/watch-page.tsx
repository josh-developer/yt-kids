import type { RecommendationGroup } from "@/entities/library";
import {
  ChannelAvatar,
  useVideoLabels,
  type Video,
} from "@/entities/video";
import { SafeYouTubePlayer } from "@/widgets/player";
import { Recommendations } from "@/widgets/recommendations";
import primitives from "@/shared/ui/primitives.module.css";
import styles from "./watch-page.module.css";

export function WatchPage({
  isTvBrowser,
  nextVideo,
  previousVideo,
  recommendationGroups,
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

  return (
    <div className={styles.watchLayout}>
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
        groups={recommendationGroups}
        isEnabled={showRecommendations}
        onOpenVideo={onOpenVideo}
        onToggle={onToggleRecommendations}
      />
    </div>
  );
}
