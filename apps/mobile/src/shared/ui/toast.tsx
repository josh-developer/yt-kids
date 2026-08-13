import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../lib/theme/use-theme";
import { space, type } from "../config/theme";

/** Long enough to read a sentence, short enough not to sit over the list. */
const VISIBLE_MS = 2600;

export type ToastState = { text: string; tone: "ok" | "bad" } | null;

/**
 * A line of text that says what just happened, then leaves.
 *
 * `ToastAndroid` would do this on one platform, and `Alert` on the other interrupts. This
 * is neither: it is the app's own type and colours, it never blocks anything, and it reads
 * the same on both. The animation is Reanimated's `entering`/`exiting`, so it runs
 * natively and costs nothing once it has gone.
 */
export function useToast() {
  const [state, setState] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);

  const show = useCallback((text: string, tone: "ok" | "bad") => {
    if (timer.current) {
      clearTimeout(timer.current);
    }

    setState({ text, tone });
    timer.current = setTimeout(() => setState(null), VISIBLE_MS);
  }, []);

  return { state, show };
}

export function Toast({ state }: { state: ToastState }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  if (!state) {
    return null;
  }

  return (
    <View
      style={[styles.host, { bottom: insets.bottom + 88 }]}
      pointerEvents="none"
    >
      <Animated.View
        entering={FadeInDown.duration(180)}
        exiting={FadeOutDown.duration(140)}
        style={[
          styles.toast,
          {
            backgroundColor: state.tone === "ok" ? colors.text : colors.brandRed,
          },
        ]}
      >
        <Text
          style={[
            styles.text,
            { color: state.tone === "ok" ? colors.surface : "#ffffff" },
          ]}
        >
          {state.text}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: space.screenX,
    right: space.screenX,
    zIndex: 9500,
    elevation: 9500,
    alignItems: "center",
  },
  toast: {
    maxWidth: "100%",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: "rgba(20, 24, 33, 0.24)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  text: { ...type.muted, textAlign: "center" },
});
