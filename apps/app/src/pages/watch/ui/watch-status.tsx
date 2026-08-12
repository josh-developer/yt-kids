import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { PlayerPlaceholder } from "@/widgets/player";
import primitives from "@/shared/ui/primitives.module.css";
import { Tooltip } from "@/shared/ui/tooltip";
import styles from "./watch-page.module.css";

/**
 * What the watch screen looks like before the library has been read.
 *
 * The approved library lives in local storage, so the server cannot know which
 * video this is and the first paint has nothing to show. That paint still has
 * to be the same shape as the one that replaces it: this mirrors `WatchPage`
 * element for element and class for class, with the copy in the player's box
 * and every other slot held open but empty. Anything less and the whole column
 * jumps the moment hydration finds the video.
 */
export function WatchLoading() {
  const t = useTranslations("Watch");

  return (
    <div className={styles.watchLayout}>
      <article>
        <PlayerPlaceholder>
          <div>
            <h2>{t("loadingTitle")}</h2>
            <p>{t("loadingBody")}</p>
          </div>
        </PlayerPlaceholder>
        <h1 className={styles.watchTitle} aria-hidden="true" />
        <div className={styles.watchBar} aria-hidden="true">
          <div className={styles.channelLine}>
            <span className={styles.pendingAvatar} />
            <div>
              <strong>&nbsp;</strong>
              <div className={primitives.muted}>&nbsp;</div>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

export function WatchUnavailable({
  onHome,
  onSettings,
}: {
  onHome: () => void;
  onSettings: () => void;
}) {
  const t = useTranslations("Watch");

  return (
    <div className={primitives.emptyState}>
      <div>
        <h2>{t("unavailableTitle")}</h2>
        <p className={primitives.muted}>{t("unavailableBody")}</p>
        <div className={primitives.emptyActions}>
          <Tooltip label={t("goHome")}>
            <button
              className={primitives.primaryButton}
              type="button"
              onClick={onHome}
            >
              {t("home")}
            </button>
          </Tooltip>
          <Tooltip label={t("openSettings")}>
            <button
              className={primitives.pillButton}
              type="button"
              onClick={onSettings}
            >
              <Plus size={18} />
              {t("parentSettings")}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
