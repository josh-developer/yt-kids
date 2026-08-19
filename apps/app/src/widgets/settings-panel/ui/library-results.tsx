import { EyeOff, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { IconButton } from "@/shared/ui/icon-button";
import {
  VideoSummary,
  VideoThumbnail,
  useVideoLabels,
  type Video,
} from "@/entities/video";
import type { CurationTab } from "@/features/library-curation";
import primitives from "@/shared/ui/primitives.module.css";
import styles from "./settings-panel.module.css";

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
      <div className={styles.libraryResults}>
        <div className={`${styles.settingsEmpty} ${primitives.muted}`}>{t("noVideosFound", { tab })}</div>
      </div>
    );
  }

  return (
    <div className={styles.libraryResults}>
      {videos.map((video) => {
        const title = labels.title(video);

        return (
          <div className={styles.resultCard} key={video.id}>
            <VideoThumbnail video={video} sizes="(max-width: 720px) 128px, 154px" />
            <div className={styles.resultInfo}>
              <VideoSummary video={video} />
            </div>
            <div className={styles.settingsRowActions}>
              {isApproved(video) ? (
                <IconButton
                  className={styles.hideIcon}
                  label={t("hideVideo", { title })}
                  tooltip={t("hide")}
                  onClick={() => onHide(video)}
                >
                  <EyeOff size={18} />
                </IconButton>
              ) : (
                <IconButton
                  className={styles.showIcon}
                  label={t("showVideo", { title })}
                  tooltip={t("show")}
                  onClick={() => onApprove(video)}
                >
                  <Plus size={18} />
                </IconButton>
              )}
              <IconButton
                className={styles.removeIcon}
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
