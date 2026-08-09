import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Video } from "@/entities/video";
import { VideoGrid } from "@/widgets/video-grid";

export function HomePage({
  videos,
  onOpenVideo,
  onSettings,
}: {
  videos: Video[];
  onOpenVideo: (video: Video) => void;
  onSettings: () => void;
}) {
  const t = useTranslations("Home");

  if (videos.length === 0) {
    return (
      <div className="empty-state">
        <div>
          <h2>{t("emptyTitle")}</h2>
          <p className="muted">{t("emptyBody")}</p>
          <button
            className="primary-button"
            type="button"
            onClick={onSettings}
            data-tooltip={t("openSettings")}
          >
            <Plus size={18} />
            {t("openSettings")}
          </button>
        </div>
      </div>
    );
  }

  return <VideoGrid videos={videos} onOpenVideo={onOpenVideo} />;
}
