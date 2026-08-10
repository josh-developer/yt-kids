import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Theme } from "@/shared/lib/platform";
import { IconButton } from "@/shared/ui/icon-button";

export function ThemeToggleButton({
  theme,
  onToggle,
}: {
  theme: Theme;
  onToggle: () => void;
}) {
  const t = useTranslations("TopBar");
  const label = theme === "dark" ? t("useLightMode") : t("useDarkMode");

  return (
    <IconButton label={label} onClick={onToggle}>
      {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
    </IconButton>
  );
}
