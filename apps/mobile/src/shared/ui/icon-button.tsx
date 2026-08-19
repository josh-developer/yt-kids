import type { ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated from "react-native-reanimated";
import { focusRing, useFocusable } from "./use-focusable";
import { useTheme } from "../lib/theme/use-theme";
import { useMetrics, useStyles, type Metrics } from "../config/metrics";

/**
 * The round control the header is made of — 42px on a phone, larger where the device
 * asks for it.
 *
 * `.iconButton` on the web, tokens and all: `--button-soft` on `--button-ink`, a 999px
 * radius, and the small `0 3px 0` shadow that makes it look pressable. Its `:hover` lift
 * becomes a press response here, because a phone has no hover but a touch still deserves
 * an acknowledgement — and the same lift, larger and with a ring, is what a D-pad landing
 * on it looks like.
 *
 * `label` is the accessibility label. The web pairs `aria-label` with an identical
 * `data-tooltip` in one place so the two cannot drift; there is no tooltip on a
 * phone, so the label is simply the one string.
 */
export function IconButton({
  label,
  children,
  isActive = false,
  hasTVPreferredFocus = false,
  onPress,
}: {
  label: string;
  children: ReactNode;
  isActive?: boolean;
  /** Where the D-pad should land when the screen this button is on first appears. */
  hasTVPreferredFocus?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const { size } = useMetrics();
  const styles = useStyles(makeStyles);
  const { handlers, style, isFocused } = useFocusable();

  return (
    <Animated.View style={style}>
      <Pressable
        onPress={onPress}
        {...handlers}
        hasTVPreferredFocus={hasTVPreferredFocus}
        style={[
          styles.button,
          {
            backgroundColor: isActive ? colors.buttonActive : colors.buttonSoft,
          },
          focusRing(size.focusRing, colors.buttonInk, isFocused),
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: isActive }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

/** The ink colour an icon inside the button should use. */
export function useIconColor(isActive = false) {
  const { colors } = useTheme();
  return isActive ? "#ffffff" : colors.buttonInk;
}

/**
 * The size to draw a glyph inside an {@link IconButton} at.
 *
 * Lucide takes a number rather than a style, so the icon cannot be scaled by the style
 * sheet the way everything around it is — each caller has to ask.
 */
export function useIconSize(base = 19) {
  return useMetrics().font(base);
}

const makeStyles = (m: Metrics) =>
  StyleSheet.create({
    button: {
      width: m.size.tapTarget,
      height: m.size.tapTarget,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      // `box-shadow: 0 3px 0 rgba(50, 55, 66, 0.08)` — a hard offset, no blur.
      shadowColor: "rgba(50, 55, 66, 0.08)",
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 1,
      shadowRadius: 0,
      elevation: 2,
    },
  });
