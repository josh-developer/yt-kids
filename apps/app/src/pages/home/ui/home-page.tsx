import { Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Video } from "@/entities/video";
import { VideoGrid } from "@/widgets/video-grid";
import primitives from "@/shared/ui/primitives.module.css";
import styles from "./home-page.module.css";

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
  const tPrivacy = useTranslations("Privacy");
  const locale = useLocale();

  // A plain anchor on purpose: the privacy page lives outside the client
  // shell (app stores need a static, public URL), so this is a real
  // navigation rather than an in-app route.
  const privacyFooter = (
    <footer className={styles.privacyFooter}>
      <a href={`/${locale}/privacy`}>{tPrivacy("title")}</a>
    </footer>
  );

  if (videos.length === 0) {
    return (
      <div className={primitives.emptyState}>
        <div>
          <h2>{t("emptyTitle")}</h2>
          <p className={primitives.muted}>{t("emptyBody")}</p>
          <button
            className={primitives.primaryButton}
            type="button"
            onClick={onSettings}
            data-tooltip={t("openSettings")}
          >
            <Plus size={18} />
            {t("openSettings")}
          </button>
          {privacyFooter}
        </div>
      </div>
    );
  }

  return (
    <>
      <VideoGrid videos={videos} onOpenVideo={onOpenVideo} />
      {privacyFooter}
    </>
  );
}
