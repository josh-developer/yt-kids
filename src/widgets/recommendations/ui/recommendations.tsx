import { useTranslations } from "next-intl";
import { VideoSummary, VideoThumbnail, type Video } from "@/entities/video";

export function Recommendations({
  videos,
  onOpenVideo,
}: {
  videos: Video[];
  onOpenVideo: (video: Video) => void;
}) {
  const t = useTranslations("Watch");

  return (
    <aside className="recommendations" aria-label={t("recommendations")}>
      {videos.map((video) => (
        <button
          className="recommendation-card"
          key={video.id}
          type="button"
          onClick={() => onOpenVideo(video)}
        >
          <VideoThumbnail video={video} />
          <VideoSummary video={video} />
        </button>
      ))}
    </aside>
  );
}
