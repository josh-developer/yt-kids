import { Plus, Search } from "lucide-react-native";
import { StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { BrandMark } from "./brand-mark";
import { useAutoHideStyle } from "../model/use-auto-hide";
import { LocaleSwitchButton } from "../../../features/locale-switch/ui/locale-switch-button";
import { ThemeToggleButton } from "../../../features/theme-toggle/ui/theme-toggle-button";
import { IconButton, useIconColor } from "../../../shared/ui/icon-button";
import { useTheme } from "../../../shared/lib/theme/use-theme";
import { useTranslations } from "../../../shared/lib/i18n/use-translations";
import { size, space, type } from "../../../shared/config/theme";

/** Brand row plus the search field below it, matching `.topbar`'s 64px plus the field. */
const SEARCH_HEIGHT = 44;
export const TOP_BAR_HEIGHT =
  size.topBarHeight + space.meta + SEARCH_HEIGHT + space.gridGap;

/**
 * The header: wordmark, actions, search.
 *
 * Floats above the list rather than scrolling with it, which is what lets it hide and
 * return under its own animation. On the web it is `position: sticky` with a
 * `translateY(-100%)` when hidden; here it is absolutely positioned and the list is
 * padded by its height, which comes to the same thing.
 *
 * The action order is the web's — theme, settings, locale — so muscle memory carries
 * between the two.
 */
export function TopBar({
  scrollY,
  topInset,
  onSettings,
}: {
  scrollY: SharedValue<number>;
  /** The status bar, so the sheet extends under it rather than starting below it. */
  topInset: number;
  onSettings: () => void;
}) {
  const { colors } = useTheme();
  const t = useTranslations("TopBar");
  const iconColor = useIconColor();
  const animated = useAutoHideStyle(scrollY, TOP_BAR_HEIGHT + topInset);

  return (
    <Animated.View
      style={[
        styles.bar,
        animated,
        {
          paddingTop: topInset,
          // `.topbar` is `rgba(255, 255, 255, 0.9)` with a 16px backdrop blur. No
          // blur here: it costs a full-screen GPU pass per frame on a scrolling
          // list, and the surface colour alone reads the same at this opacity.
          backgroundColor: colors.surface,
          borderBottomColor: colors.line,
        },
      ]}
    >
      <View style={styles.row}>
        <BrandMark />

        <View style={styles.actions}>
          <ThemeToggleButton />
          <IconButton label={t("parentSettings")} onPress={onSettings}>
            <Plus size={19} color={iconColor} />
          </IconButton>
          <LocaleSwitchButton />
        </View>
      </View>

      {/* Presentational until the query filtering is ported from the web's
          `video-library.ts`; the layout would misrepresent the screen without it. */}
      <View
        style={[
          styles.search,
          { backgroundColor: colors.surface, borderColor: colors.line },
        ]}
      >
        <Search size={18} color={colors.textSoft} />
        <Text style={[styles.searchLabel, { color: colors.textSoft }]}>
          {t("searchApprovedVideos")}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5000,
    paddingHorizontal: space.screenX,
    paddingBottom: space.gridGap,
    gap: space.meta,
    borderBottomWidth: StyleSheet.hairlineWidth,
    // `box-shadow: 0 10px 28px rgba(49, 71, 93, 0.08)`.
    shadowColor: "rgba(49, 71, 93, 0.08)",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 8,
  },
  row: {
    height: size.topBarHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  actions: { flexDirection: "row", alignItems: "center", gap: 10 },
  search: {
    height: SEARCH_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  searchLabel: type.muted,
});
