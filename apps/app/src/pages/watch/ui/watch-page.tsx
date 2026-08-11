import { useTranslations } from "next-intl";
import { useMemo, useRef } from "react";
import type { RecommendationGroup } from "@/entities/library";
import {
  ChannelAvatar,
  useVideoLabels,
  type Video,
} from "@/entities/video";
import { Recommendations } from "@/widgets/recommendations";
import { thumbnailUrl } from "@/shared/api/youtube";
import { PlaybackPositions } from "@/shared/lib/playback/playback-positions";
import primitives from "@/shared/ui/primitives.module.css";
import { KidVideoPlayer } from "@/shared/ui/video-player/kid-video-player";
import styles from "./watch-page.module.css";

export function WatchPage({
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
  const t = useTranslations("Player");
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
        <KidVideoPlayer
          videoId={video.videoId}
          title={labels.title(video)}
          posterUrl={thumbnailUrl(video.videoId, "poster")}
          autoPlay
          labels={{
            play: t("play"),
            pause: t("pause"),
            mute: t("mute"),
            unmute: t("unmute"),
            seek: t("seek"),
            enterFullscreen: t("fullScreen"),
            exitFullscreen: t("exitFullScreen"),
            nextVideo: t("nextVideo"),
            previousVideo: t("previousVideo"),
            lockControls: t("lockControls"),
            unlockControls: t("unlockControls"),
            back15: t("back15"),
            forward15: t("forward15"),
            repeatOn: t("repeatOneEnabled"),
            repeatOff: t("repeatOneDisabled"),
            surface: t("surface", { title: labels.title(video) }),
          }}
          startTime={startTime}
          onTimeUpdate={(seconds) =>
            positions.save(video.videoId, seconds, durationRef.current)
          }
          onDurationChange={(seconds) => {
            durationRef.current = seconds;
            onDurationResolved(video, seconds);
          }}
          onFullscreenChange={onFullscreenChange}
          onNextVideo={nextVideo ? onNextVideo : undefined}
          onPreviousVideo={previousVideo ? onPreviousVideo : undefined}
          nextVideoPreview={
            nextVideo
              ? {
                  title: labels.title(nextVideo),
                  thumbnailUrl: thumbnailUrl(nextVideo.videoId),
                  subtitle: labels.channel(nextVideo),
                }
              : undefined
          }
          previousVideoPreview={
            previousVideo
              ? {
                  title: labels.title(previousVideo),
                  thumbnailUrl: thumbnailUrl(previousVideo.videoId),
                  subtitle: labels.channel(previousVideo),
                }
              : undefined
          }
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
