import type { ReactNode } from "react";
import { Pressable, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useTheme } from "../lib/theme/use-theme";

/**
 * The round 42px control the header is made of.
 *
 * `.iconButton` on the web, tokens and all: `--button-soft` on
 * `--button-ink`, a 999px radius, and the small `0 3px 0` shadow that makes it
 * look pressable. Its `:hover` lift becomes a press response here, because a phone
 * has no hover but a touch still deserves an acknowledgement.
 *
 * `label` is the accessibility label. The web pairs `aria-label` with an identical
 * `data-tooltip` in one place so the two cannot drift; there is no tooltip on a
 * phone, so the label is simply the one string.
 */
export function IconButton({
  label,
  children,
  isActive = false,
  onPress,
}: {
  label: string;
  children: ReactNode;
  isActive?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const pressed = useSharedValue(0);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.06 }],
  }));

  return (
    <Animated.View style={animated}>
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          pressed.value = withSpring(1, { damping: 18, stiffness: 420 });
        }}
        onPressOut={() => {
          pressed.value = withSpring(0, { damping: 18, stiffness: 320 });
        }}
        style={[
          styles.button,
          {
            backgroundColor: isActive ? colors.buttonActive : colors.buttonSoft,
          },
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

const styles = StyleSheet.create({
  button: {
    width: 42,
    height: 42,
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
