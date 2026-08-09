import { EyeOff, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { IconButton } from "@/shared/ui/icon-button";
import { VideoThumbnail, useVideoLabels, type Video } from "@/entities/video";
import type { CurationTab } from "@/features/library-curation";

export function LibraryResults({
  isApproved,
  tab,
  videos,
  onApprove,
  onHide,
  onRemove,
}: {
  isApproved: (video: Video) => boolean;
  tab: CurationTab;
  videos: Video[];
  onApprove: (video: Video) => void;
  onHide: (video: Video) => void;
  onRemove: (video: Video) => void;
}) {
  const t = useTranslations("Settings");
  const labels = useVideoLabels();

  if (videos.length === 0) {
    return (
      <div className="library-results">
        <div className="settings-empty muted">{t("noVideosFound", { tab })}</div>
      </div>
    );
  }

  return (
    <div className="library-results">
      {videos.map((video) => {
        const title = labels.title(video);

        return (
          <div className="result-card" key={video.id}>
            <VideoThumbnail video={video} />
            <div className="result-info">
              <span className="video-title">{title}</span>
              <span className="video-subline">{labels.channel(video)}</span>
            </div>
            <div className="settings-row-actions">
              {isApproved(video) ? (
                <IconButton
                  className="hide-icon"
                  label={t("hideVideo", { title })}
                  tooltip={t("hide")}
                  onClick={() => onHide(video)}
                >
                  <EyeOff size={18} />
                </IconButton>
              ) : (
                <IconButton
                  className="show-icon"
                  label={t("showVideo", { title })}
                  tooltip={t("show")}
                  onClick={() => onApprove(video)}
                >
                  <Plus size={18} />
                </IconButton>
              )}
              <IconButton
                className="remove-icon"
                label={t("removeVideoCompletely", { title })}
                tooltip={t("removeCompletely")}
                onClick={() => onRemove(video)}
              >
                <Trash2 size={18} />
              </IconButton>
            </div>
          </div>
        );
      })}
    </div>
  );
}
