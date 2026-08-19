import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
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
import { FocusZone } from "./focus-zone";
import { useTheme } from "../lib/theme/use-theme";
import { useDevice } from "../lib/device/use-device";
import { useTranslations } from "../lib/i18n/use-translations";
import { useMetrics, useStyles, type Metrics } from "../config/metrics";

const DURATION = 240;
/** Past this much of the sheet's own height, letting go closes it. */
const DISMISS_RATIO = 0.3;
/** A flick closes it early, but only once it has travelled far enough to be one. */
const DISMISS_VELOCITY = 900;
const FLICK_DISTANCE = 32;
/** How small a dialog starts before it settles. Small enough to read as arriving. */
const DIALOG_START_SCALE = 0.94;

/**
 * The small task the settings screen hands off — importing a code, adding a link,
 * confirming a reset — as a sheet on a phone and a dialog on anything larger.
 *
 * **A phone gets a sheet**: up from the bottom edge, a grabber, and a drag that closes it.
 * That is where a thumb already is, and the gesture is the fastest way back out.
 *
 * **A tablet and a television get a dialog**: centred, rounded on every corner, and it
 * scales in rather than sliding. A sheet is an answer to a thumb's reach on a small screen,
 * and neither of those has that problem — on a 1280dp tablet the bottom edge is a long way
 * from wherever you are looking, and on a television it is across the room. Sliding a
 * centred panel up from the floor would also read as a sheet that overshot rather than a
 * dialog that opened.
 *
 * Which one is chosen by *device* rather than by window width, so a tablet does not change
 * its mind halfway through a rotation while someone is typing a URL into it.
 *
 * Gesture Handler drives the phone's drag, unlike the watch sheet's `PanResponder`. Nothing
 * in these is a WebView, so the recognisers see the touches and the UI-thread pan is the
 * smoother of the two. The drag is switched off for the dialog, which has no edge to be
 * dragged towards; the backdrop and its own buttons are the ways out.
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
  const { kind, isTV } = useDevice();
  const insets = useSafeAreaInsets();
  const t = useTranslations("Settings");
  const m = useMetrics();
  const styles = useStyles(makeStyles);
  const { height } = useWindowDimensions();

  const isDialog = kind !== "phone";

  /** The sheet's travel. Untouched on the dialog path, which does not slide. */
  const translateY = useSharedValue(isDialog ? 0 : height);
  /** The dialog's arrival, 0 to 1. Unused by the sheet, which animates its offset. */
  const shown = useSharedValue(isDialog ? 0 : 1);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (isDialog) {
      shown.value = withTiming(1, {
        duration: DURATION,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      translateY.value = withTiming(0, {
        duration: DURATION,
        easing: Easing.out(Easing.cubic),
      });
    }

    backdrop.value = withTiming(1, { duration: DURATION });
  }, [backdrop, isDialog, shown, translateY]);

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
        // A centred dialog has nowhere to be dragged to.
        .enabled(!isDialog)
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
    [backdrop, height, isDialog, translateY],
  );
  /* eslint-enable react-hooks/immutability */

  const panelStyle = useAnimatedStyle(() =>
    isDialog
      ? {
          opacity: shown.value,
          transform: [
            {
              scale:
                DIALOG_START_SCALE + shown.value * (1 - DIALOG_START_SCALE),
            },
          ],
        }
      : { transform: [{ translateY: translateY.value }] },
  );

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

      {/*
        `box-none` so a tap that misses the panel still reaches the backdrop underneath.

        The keyboard is the reason this is a `KeyboardAvoidingView` rather than a plain one.
        A sheet sits on the bottom edge and Android's `adjustResize` lifts it for free; a
        *centred* dialog holding a URL field has to be moved out of the keyboard's way
        explicitly, and iOS does not resize the window at all.
      */}
      <KeyboardAvoidingView
        style={[styles.stack, isDialog ? styles.stackCentred : styles.stackBottom]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        pointerEvents="box-none"
      >
        <GestureDetector gesture={drag}>
          <Animated.View
            style={[
              styles.panel,
              isDialog ? styles.panelDialog : styles.panelSheet,
              panelStyle,
              {
                backgroundColor: colors.surface,
                paddingBottom: isDialog
                  ? m.space.gridGap
                  : insets.bottom + m.space.gridGap,
              },
            ]}
          >
            {/* A grabber names a gesture. The dialog has none, so drawing one is a lie
                about how to get back out. */}
            {isDialog ? null : (
              <View style={styles.grabberRow}>
                <View style={[styles.grabber, { backgroundColor: colors.line }]} />
              </View>
            )}

            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>

            {/* Trapped on all four sides on a television: a dialog nobody can leave by
                accident is the only kind that makes sense when leaving would mean pressing
                an arrow key. The traps are inert off TV, where this is a plain `View`. */}
            <FocusZone
              style={styles.body}
              trapLeft={isTV}
              trapRight={isTV}
              trapUp={isTV}
              trapDown={isTV}
            >
              {children}
            </FocusZone>
          </Animated.View>
        </GestureDetector>
      </KeyboardAvoidingView>
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
    },
    backdrop: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: "rgba(8, 8, 10, 0.44)",
    },
    stack: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
    stackBottom: { justifyContent: "flex-end" },
    stackCentred: { justifyContent: "center", padding: m.space.gridGap },
    panel: {
      paddingHorizontal: m.space.screenX,
      gap: m.space.meta,
      /**
       * Capped and centred. A panel that spans a tablet is a form field a metre wide with
       * its title stranded in the far corner; the phone's full-bleed version is full-bleed
       * only because a phone is already this narrow.
       */
      width: "100%",
      maxWidth: 560,
      alignSelf: "center",
    },
    /** Square along the bottom, because that edge is the screen's. */
    panelSheet: {
      borderTopLeftRadius: m.radius.sheet,
      borderTopRightRadius: m.radius.sheet,
      // `0 -12px 34px rgba(20, 24, 33, 0.18)`, as a sheet lifting off the screen.
      shadowColor: "rgba(20, 24, 33, 0.18)",
      shadowOffset: { width: 0, height: -12 },
      shadowOpacity: 1,
      shadowRadius: 17,
      elevation: 12,
    },
    /** Rounded all round, and lit from above like something floating over the screen. */
    panelDialog: {
      borderRadius: m.radius.sheet,
      paddingTop: m.space.gridGap,
      shadowColor: "rgba(20, 24, 33, 0.28)",
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: 1,
      shadowRadius: 30,
      elevation: 24,
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
