import { useTranslations } from "next-intl";
import { VideoSummary, VideoThumbnail, type Video } from "@/entities/video";
import { RecommendationsToggle } from "@/features/recommendations-toggle";
import { VirtualGrid } from "@/shared/ui/virtual-grid";

export function Recommendations({
  isEnabled,
  videos,
  onOpenVideo,
  onToggle,
}: {
  isEnabled: boolean;
  videos: Video[];
  onOpenVideo: (video: Video) => void;
  onToggle: () => void;
}) {
  const t = useTranslations("Watch");

  return (
    <aside className="recommendations-panel">
      <RecommendationsToggle isEnabled={isEnabled} onToggle={onToggle} />

      {isEnabled ? (
        <VirtualGrid
          items={videos}
          className="recommendations"
          ariaLabel={t("recommendations")}
          getKey={(video) => video.id}
          renderItem={(video) => (
            <button
              className="recommendation-card"
              type="button"
              onClick={() => onOpenVideo(video)}
            >
              <VideoThumbnail video={video} />
              <VideoSummary video={video} />
            </button>
          )}
        />
      ) : null}
    </aside>
  );
}
