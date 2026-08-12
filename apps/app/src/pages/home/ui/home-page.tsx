import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Video } from "@/entities/video";
import { VideoGrid } from "@/widgets/video-grid";
import primitives from "@/shared/ui/primitives.module.css";
import { Tooltip } from "@/shared/ui/tooltip";

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
      <div className={primitives.emptyState}>
        <div>
          <h2>{t("emptyTitle")}</h2>
          <p className={primitives.muted}>{t("emptyBody")}</p>
          <Tooltip label={t("openSettings")}>
            <button
              className={primitives.primaryButton}
              type="button"
              onClick={onSettings}
            >
              <Plus size={18} />
              {t("openSettings")}
            </button>
          </Tooltip>
        </div>
      </div>
    );
  }

  return <VideoGrid videos={videos} onOpenVideo={onOpenVideo} />;
}
