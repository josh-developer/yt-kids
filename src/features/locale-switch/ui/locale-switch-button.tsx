"use client";

import { Languages } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/shared/config/i18n/routing";

export function LocaleSwitchButton({
  nextLocale,
  onSwitch,
}: {
  nextLocale: AppLocale;
  onSwitch: () => void;
}) {
  const t = useTranslations("LocaleSwitcher");

  return (
    <button
      className="language-button"
      type="button"
      onClick={onSwitch}
      aria-label={t("label")}
      data-tooltip={t("name", { locale: nextLocale })}
    >
      <Languages size={18} />
      <span>{t("short", { locale: nextLocale })}</span>
    </button>
  );
}
