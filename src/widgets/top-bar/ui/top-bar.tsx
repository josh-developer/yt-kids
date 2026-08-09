import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import type { AppLocale } from "@/shared/config/i18n/routing";
import type { AppView } from "@/shared/lib/routing/app-routes";
import type { Theme } from "@/shared/lib/platform";
import { IconButton } from "@/shared/ui/icon-button";
import { LocaleSwitchButton } from "@/features/locale-switch";
import { ThemeToggleButton } from "@/features/theme-toggle";
import { VideoSearchField } from "@/features/video-search";
import { BrandButton } from "./brand-button";

export function TopBar({
  homeQuery,
  isHidden,
  nextLocale,
  theme,
  view,
  onHome,
  onHomeQueryChange,
  onLocaleSwitch,
  onSearchSubmit,
  onSettings,
  onThemeToggle,
}: {
  homeQuery: string;
  isHidden: boolean;
  nextLocale: AppLocale;
  theme: Theme;
  view: AppView;
  onHome: () => void;
  onHomeQueryChange: (value: string) => void;
  onLocaleSwitch: () => void;
  onSearchSubmit: () => void;
  onSettings: () => void;
  onThemeToggle: () => void;
}) {
  const t = useTranslations("TopBar");

  return (
    <header className={`topbar ${isHidden ? "topbar-hidden" : ""}`}>
      <BrandButton onClick={onHome} />

      <div className="top-search-slot">
        <VideoSearchField
          query={homeQuery}
          onQueryChange={onHomeQueryChange}
          onSubmit={onSearchSubmit}
        />
      </div>

      <div className="top-actions">
        <ThemeToggleButton theme={theme} onToggle={onThemeToggle} />
        <IconButton
          label={t("parentSettings")}
          isActive={view === "settings"}
          onClick={onSettings}
        >
          <Plus size={19} />
        </IconButton>
        <LocaleSwitchButton nextLocale={nextLocale} onSwitch={onLocaleSwitch} />
      </div>
    </header>
  );
}
