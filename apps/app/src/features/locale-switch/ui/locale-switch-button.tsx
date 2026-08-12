import { Languages } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@repo/internationalization/routing";
import primitives from "@/shared/ui/primitives.module.css";
import { Tooltip } from "@/shared/ui/tooltip";

export function LocaleSwitchButton({
  nextLocale,
  onSwitch,
}: {
  nextLocale: AppLocale;
  onSwitch: () => void;
}) {
  const t = useTranslations("LocaleSwitcher");

  return (
    <Tooltip label={t("name", { locale: nextLocale })}>
      <button
        className={primitives.languageButton}
        type="button"
        onClick={onSwitch}
        aria-label={t("label")}
      >
        <Languages size={18} />
        <span>{t("short", { locale: nextLocale })}</span>
      </button>
    </Tooltip>
  );
}
