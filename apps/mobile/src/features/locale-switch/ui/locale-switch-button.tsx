import { Languages } from "lucide-react-native";
import { Pressable, StyleSheet, Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useTheme } from "../../../shared/lib/theme/use-theme";
import {
  useLocale,
  useTranslations,
} from "../../../shared/lib/i18n/use-translations";
import {
  useMetrics,
  useStyles,
  type Metrics,
} from "../../../shared/config/metrics";

/**
 * Switches between the two locales, showing the one it will switch *to*.
 *
 * A wider pill rather than the round `IconButton`, matching `.languageButton` on the
 * web: `min-width: 58px`, an 8px radius rather than a circle, and the code beside
 * the glyph. The label comes from the catalog's `select` entry, which is why this app
 * runs real ICU rather than a hand-rolled subset.
 *
 * Switching is local state here. On the web it is a navigation — the server owns the
 * messages, `<html lang>` and the cookie — but the catalogs are in this bundle, so
 * there is nothing to fetch and nothing to route.
 */
export function LocaleSwitchButton() {
  const { colors } = useTheme();
  const { nextLocale, switchLocale } = useLocale();
  const t = useTranslations("LocaleSwitcher");
  const m = useMetrics();
  const styles = useStyles(makeStyles);
  const pressed = useSharedValue(0);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.06 }],
  }));

  return (
    <Animated.View style={animated}>
      <Pressable
        onPress={switchLocale}
        onPressIn={() => {
          pressed.value = withSpring(1, { damping: 18, stiffness: 420 });
        }}
        onPressOut={() => {
          pressed.value = withSpring(0, { damping: 18, stiffness: 320 });
        }}
        style={[styles.button, { backgroundColor: colors.buttonSoft }]}
        accessibilityRole="button"
        accessibilityLabel={t("label")}
      >
        <Languages size={m.font(18)} color={colors.buttonInk} />
        <Text style={[styles.code, { color: colors.buttonInk }]}>
          {t("short", { locale: nextLocale })}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (m: Metrics) =>
  StyleSheet.create({
    button: {
      minWidth: m.font(58),
      height: m.size.tapTarget,
      paddingHorizontal: m.space.meta,
      borderRadius: m.radius.card,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: m.font(4),
      shadowColor: "rgba(50, 55, 66, 0.08)",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 2,
    },
    // `.languageButton` inherits the 700 weight from the button primitives.
    code: { fontFamily: m.fonts.bold, fontSize: m.font(14) },
  });
