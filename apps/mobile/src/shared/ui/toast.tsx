import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../lib/theme/use-theme";
import { useMetrics, useStyles, type Metrics } from "../config/metrics";

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
  const m = useMetrics();
  const styles = useStyles(makeStyles);

  if (!state) {
    return null;
  }

  return (
    <View
      style={[styles.host, { bottom: insets.bottom + m.font(88) }]}
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

const makeStyles = (m: Metrics) =>
  StyleSheet.create({
    host: {
      position: "absolute",
      left: m.space.screenX,
      right: m.space.screenX,
      zIndex: 9500,
      elevation: 9500,
      alignItems: "center",
    },
    toast: {
      maxWidth: "100%",
      paddingHorizontal: m.font(16),
      paddingVertical: m.space.meta,
      borderRadius: 999,
      shadowColor: "rgba(20, 24, 33, 0.24)",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 1,
      shadowRadius: 12,
    },
    text: { ...m.type.muted, textAlign: "center" },
  });
