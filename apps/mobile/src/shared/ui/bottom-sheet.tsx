import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../lib/theme/use-theme";
import { useTranslations } from "../lib/i18n/use-translations";
import { useMetrics, useStyles, type Metrics } from "../config/metrics";

const DURATION = 240;
/** Past this much of the sheet's own height, letting go closes it. */
const DISMISS_RATIO = 0.3;
/** A flick closes it early, but only once it has travelled far enough to be one. */
const DISMISS_VELOCITY = 900;
const FLICK_DISTANCE = 32;

/**
 * A sheet from the bottom, with a grabber and a drag that closes it.
 *
 * One implementation for every small task the settings screen hands off — importing a
 * code, adding a link, confirming a reset — so all three behave the same and none of them
 * is a modal dialog borrowed from a desktop.
 *
 * Gesture Handler drives the drag here, unlike the watch sheet's `PanResponder`. Nothing
 * in these sheets is a WebView, so the recognisers see the touches, and the UI-thread pan
 * is the smoother of the two.
 *
 * The backdrop is a plain press rather than a gesture: tapping outside is a tap, and
 * treating it as one keeps it from competing with the drag.
 */
export function BottomSheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslations("Settings");
  const m = useMetrics();
  const styles = useStyles(makeStyles);
  const { height } = useWindowDimensions();

  const translateY = useSharedValue(height);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    translateY.value = withTiming(0, {
      duration: DURATION,
      easing: Easing.out(Easing.cubic),
    });
    backdrop.value = withTiming(1, { duration: DURATION });
  }, [backdrop, translateY]);

  function close() {
    Keyboard.dismiss();
    onClose();
  }

  // Built once; the writes below are Reanimated's API from a gesture callback, which the
  // React Compiler's `immutability` rule reads as mutating something captured.
  /* eslint-disable react-hooks/immutability -- Reanimated shared-value writes. */
  const drag = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-12, 12])
        .onUpdate((event) => {
          // Downward only: the sheet is already as far up as it goes.
          translateY.value = Math.max(0, event.translationY);
        })
        .onEnd((event, success) => {
          const isDismissed =
            success &&
            (event.translationY > height * DISMISS_RATIO ||
              (event.translationY > FLICK_DISTANCE &&
                event.velocityY > DISMISS_VELOCITY));

          if (isDismissed) {
            backdrop.value = withTiming(0, { duration: DURATION });
            translateY.value = withTiming(
              height,
              { duration: DURATION, easing: Easing.in(Easing.cubic) },
              (finished) => {
                if (finished) {
                  scheduleOnRN(close);
                }
              },
            );
            return;
          }

          translateY.value = withTiming(0, {
            duration: DURATION,
            easing: Easing.out(Easing.cubic),
          });
        }),
    // `close` is stable for the life of the sheet; the height is what the maths needs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [backdrop, height, translateY],
  );
  /* eslint-enable react-hooks/immutability */

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdrop.value,
  }));

  return (
    <View style={styles.host}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel={t("close")}
        />
      </Animated.View>

      <GestureDetector gesture={drag}>
        <Animated.View
          style={[
            styles.sheet,
            sheetStyle,
            {
              backgroundColor: colors.surface,
              paddingBottom: insets.bottom + m.space.gridGap,
            },
          ]}
        >
          <View style={styles.grabberRow}>
            <View style={[styles.grabber, { backgroundColor: colors.line }]} />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

          <View style={styles.body}>{children}</View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const makeStyles = (m: Metrics) =>
  StyleSheet.create({
    host: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 8000,
      elevation: 8000,
      justifyContent: "flex-end",
    },
    backdrop: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: "rgba(8, 8, 10, 0.44)",
    },
    sheet: {
      paddingHorizontal: m.space.screenX,
      borderTopLeftRadius: m.radius.sheet,
      borderTopRightRadius: m.radius.sheet,
      gap: m.space.meta,
      /**
       * Capped and centred on a wide screen. A sheet that spans a tablet is a form field a
       * metre wide and a title stranded in the far corner; the phone's full-bleed version is
       * full-bleed only because a phone is already this narrow.
       */
      width: "100%",
      maxWidth: 560,
      alignSelf: "center",
      // `0 -12px 34px rgba(20, 24, 33, 0.18)`, as a sheet lifting off the screen.
      shadowColor: "rgba(20, 24, 33, 0.18)",
      shadowOffset: { width: 0, height: -12 },
      shadowOpacity: 1,
      shadowRadius: 17,
    },
    grabberRow: {
      alignItems: "center",
      paddingTop: m.space.meta,
      paddingBottom: m.font(4),
    },
    grabber: { width: m.font(44), height: m.font(5), borderRadius: 999 },
    title: {
      ...m.type.cardTitle,
      fontSize: m.font(18),
      lineHeight: m.font(23),
      minHeight: 0,
    },
    body: { gap: m.space.meta, paddingBottom: m.space.meta },
  });
