import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import primitives from "@/shared/ui/primitives.module.css";

export function WatchLoading() {
  const t = useTranslations("Watch");

  return (
    <div className={primitives.emptyState}>
      <div>
        <h2>{t("loadingTitle")}</h2>
        <p className={primitives.muted}>{t("loadingBody")}</p>
      </div>
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
          <button
            className={primitives.primaryButton}
            type="button"
            onClick={onHome}
            data-tooltip={t("goHome")}
          >
            {t("home")}
          </button>
          <button
            className={primitives.pillButton}
            type="button"
            onClick={onSettings}
            data-tooltip={t("openSettings")}
          >
            <Plus size={18} />
            {t("parentSettings")}
          </button>
        </div>
      </div>
    </div>
  );
}
