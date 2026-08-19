import { Plus } from "lucide-react-native";
import { Keyboard, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { BrandMark } from "./brand-mark";
import { useAutoHideStyle } from "../model/use-auto-hide";
import { LocaleSwitchButton } from "../../../features/locale-switch/ui/locale-switch-button";
import {
  useSearchFieldHeight,
  VideoSearchField,
} from "../../../features/video-search/ui/video-search-field";
import { ThemeToggleButton } from "../../../features/theme-toggle/ui/theme-toggle-button";
import {
  IconButton,
  useIconColor,
  useIconSize,
} from "../../../shared/ui/icon-button";
import { useTheme } from "../../../shared/lib/theme/use-theme";
import { useDevice } from "../../../shared/lib/device/use-device";
import { useTranslations } from "../../../shared/lib/i18n/use-translations";
import { useMetrics, useStyles, type Metrics } from "../../../shared/config/metrics";

/**
 * How tall the header is, which the list under it has to be padded by.
 *
 * A hook rather than the constant it was, because every term in the sum now depends on the
 * device — and on a wide window there is one term fewer, since the search field moves up
 * into the brand row instead of sitting under it.
 */
export function useTopBarHeight() {
  const { isWide } = useDevice();
  const { size, space } = useMetrics();
  const searchHeight = useSearchFieldHeight();

  if (isWide) {
    return size.topBarHeight + space.gridGap;
  }

  return size.topBarHeight + space.meta + searchHeight + space.gridGap;
}

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
 *
 * On a wide window the search field sits *in* the brand row rather than below it. That is
 * the web's own layout above 720px, and it is the honest use of the space: a full-width
 * search field on a tablet is a 900px input for a two-word query, and stacking it costs a
 * row of cards for nothing.
 */
export function TopBar({
  scrollY,
  topInset,
  query,
  onQueryChange,
  onSettings,
}: {
  scrollY: SharedValue<number>;
  /** The status bar, so the sheet extends under it rather than starting below it. */
  topInset: number;
  query: string;
  onQueryChange: (value: string) => void;
  onSettings: () => void;
}) {
  const { colors } = useTheme();
  const { isWide } = useDevice();
  const t = useTranslations("TopBar");
  const iconColor = useIconColor();
  const iconSize = useIconSize();
  const styles = useStyles(makeStyles);
  const barHeight = useTopBarHeight();
  const animated = useAutoHideStyle(scrollY, barHeight + topInset);

  // Filtering happens as it is typed, so submitting only dismisses the keyboard.
  const search = (
    <VideoSearchField
      query={query}
      onQueryChange={onQueryChange}
      onSubmit={() => Keyboard.dismiss()}
    />
  );

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

        {isWide ? <View style={styles.inlineSearch}>{search}</View> : null}

        <View style={styles.actions}>
          <ThemeToggleButton />
          <IconButton label={t("parentSettings")} onPress={onSettings}>
            <Plus size={iconSize} color={iconColor} />
          </IconButton>
          <LocaleSwitchButton />
        </View>
      </View>

      {isWide ? null : search}
    </Animated.View>
  );
}

const makeStyles = (m: Metrics) =>
  StyleSheet.create({
    bar: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 5000,
      paddingHorizontal: m.space.screenX,
      paddingBottom: m.space.gridGap,
      gap: m.space.meta,
      borderBottomWidth: StyleSheet.hairlineWidth,
      // `box-shadow: 0 10px 28px rgba(49, 71, 93, 0.08)`.
      shadowColor: "rgba(49, 71, 93, 0.08)",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 1,
      shadowRadius: 14,
      elevation: 8,
    },
    row: {
      height: m.size.topBarHeight,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: m.space.gridGap,
    },
    /**
     * Capped rather than merely flexed. A search field is not more useful for being
     * 900px wide, and letting it take the whole middle of a tablet header pushes the
     * wordmark and the actions to opposite edges of the screen.
     */
    inlineSearch: { flex: 1, maxWidth: 420 },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: m.space.meta,
    },
  });
