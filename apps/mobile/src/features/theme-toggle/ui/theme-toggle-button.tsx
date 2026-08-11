import { Moon, Sun } from "lucide-react-native";
import { IconButton, useIconColor } from "../../../shared/ui/icon-button";
import { useTheme } from "../../../shared/lib/theme/use-theme";
import { useTranslations } from "../../../shared/lib/i18n/use-translations";

/**
 * Sun in the dark, moon in the light — the icon shows what tapping does, exactly as
 * on the web, and from the same `lucide` set so the glyphs are identical rather
 * than similar.
 */
export function ThemeToggleButton() {
  const { name, toggle } = useTheme();
  const t = useTranslations("TopBar");
  const color = useIconColor();

  return (
    <IconButton
      label={name === "dark" ? t("useLightMode") : t("useDarkMode")}
      onPress={toggle}
    >
      {name === "dark" ? (
        <Sun size={19} color={color} />
      ) : (
        <Moon size={19} color={color} />
      )}
    </IconButton>
  );
}
