"use client";

import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

export function WatchLoading() {
  const t = useTranslations("Watch");

  return (
    <div className="empty-state">
      <div>
        <h2>{t("loadingTitle")}</h2>
        <p className="muted">{t("loadingBody")}</p>
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
    <div className="empty-state">
      <div>
        <h2>{t("unavailableTitle")}</h2>
        <p className="muted">{t("unavailableBody")}</p>
        <div className="empty-actions">
          <button
            className="primary-button"
            type="button"
            onClick={onHome}
            data-tooltip={t("goHome")}
          >
            {t("home")}
          </button>
          <button
            className="pill-button"
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
