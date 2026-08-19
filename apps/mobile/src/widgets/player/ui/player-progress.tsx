import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { useTranslations } from "../../../shared/lib/i18n/use-translations";
import { fonts } from "../../../shared/config/theme";
import { useMetrics, useStyles, type Metrics } from "../../../shared/config/metrics";

/**
 * The page reports a position every 250ms, so the fill is given that long to travel.
 * Linear, because playback is: any easing would make the bar surge and slow between
 * ticks it has no business interpreting.
 */
const TICK_MS = 250;
/** How much of a drag is worth telling JS about, for the time readout. */
const READOUT_STEP = 0.004;

/**
 * `.playerProgressWrap`: the bar and the time beside it.
 *
 * The fill is a shared value rather than a percentage in a style prop, and that is the
 * whole point of this file. Position arrives four times a second, so a fill driven
 * straight from state moved in four visible steps a second — the "not smooth" of the
 * report. Here each new position animates linearly over one tick's worth of time, on the
 * UI thread, so the bar glides at the speed the video is playing.
 *
 * A drag takes the same value over: the finger writes it directly, so the bar tracks
 * without a round trip through JS, and only the release seeks. The time readout is state
 * and cannot live on the UI thread, so a drag updates it at about a percent of travel —
 * often enough to read, rarely enough not to matter.
 */
export function PlayerProgress({
  position,
  duration,
  insetBottom,
  insetLeft,
  insetRight,
  onSeekToFraction,
}: {
  position: number;
  duration: number;
  insetBottom: number;
  insetLeft: number;
  insetRight: number;
  onSeekToFraction: (fraction: number) => void;
}) {
  const t = useTranslations("Player");
  const m = useMetrics();
  const styles = useStyles(makeStyles);
  const [trackWidth, setTrackWidth] = useState(0);
  /** Set while a finger owns the bar; the readout shows this instead of the position. */
  const [dragFraction, setDragFraction] = useState<number | null>(null);

  const fill = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const progress =
    duration > 0 ? Math.min(1, Math.max(0, position / duration)) : 0;

  useEffect(() => {
    if (isDragging.value) {
      return;
    }

    // A seek arrives as a jump: catching up over a tick would crawl there instead.
    const isJump = Math.abs(progress - fill.value) > 0.08;
    fill.value = isJump
      ? progress
      : withTiming(progress, {
          duration: TICK_MS,
          easing: Easing.linear,
        });
  }, [fill, isDragging, progress]);

  // The worklet writes below are the canonical Reanimated API from a gesture callback;
  // the React Compiler's `immutability` rule does not model worklets, so it reads them as
  // mutations of something captured. Silenced here and nowhere wider — the same
  // suppression the watch sheet's drag needs.
  /* eslint-disable react-hooks/immutability -- Reanimated shared-value writes. */
  const scrub = useMemo(
    () =>
      Gesture.Pan()
        // No slop: a tap on the bar is a seek to that point, as on the web.
        .minDistance(0)
        .onBegin((event) => {
          if (trackWidth <= 0) {
            return;
          }

          cancelAnimation(fill);
          isDragging.value = true;
          const fraction = Math.min(1, Math.max(0, event.x / trackWidth));
          fill.value = fraction;
          scheduleOnRN(setDragFraction, fraction);
        })
        .onUpdate((event) => {
          if (trackWidth <= 0) {
            return;
          }

          const fraction = Math.min(1, Math.max(0, event.x / trackWidth));
          const previous = fill.value;
          fill.value = fraction;

          if (Math.abs(fraction - previous) > READOUT_STEP) {
            scheduleOnRN(setDragFraction, fraction);
          }
        })
        .onEnd((event) => {
          if (trackWidth <= 0) {
            return;
          }

          const fraction = Math.min(1, Math.max(0, event.x / trackWidth));
          isDragging.value = false;
          fill.value = fraction;
          scheduleOnRN(onSeekToFraction, fraction);
          scheduleOnRN(setDragFraction, null);
        })
        .onFinalize(() => {
          isDragging.value = false;
        }),
    [fill, isDragging, onSeekToFraction, trackWidth],
  );
  /* eslint-enable react-hooks/immutability */

  const fillStyle = useAnimatedStyle(() => ({
    width: `${fill.value * 100}%`,
  }));

  const shown = dragFraction === null ? position : dragFraction * duration;

  return (
    <View
      style={[
        styles.wrap,
        {
          // Clear of the control strip, which is itself the device's size.
          bottom: m.font(54) + insetBottom,
          left: m.space.screenX + insetLeft,
          right: m.space.screenX + insetRight,
        },
      ]}
      pointerEvents="box-none"
    >
      <GestureDetector gesture={scrub}>
        <View
          style={styles.touch}
          onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
          accessibilityRole="adjustable"
          accessibilityLabel={t("seek")}
        >
          <View style={styles.track}>
            <Animated.View style={[styles.fill, fillStyle]}>
              <LinearGradient
                colors={["#ff3157", "#ffd84d"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.gradient}
              />
            </Animated.View>
          </View>
        </View>
      </GestureDetector>

      <View style={styles.timePill}>
        <Text style={styles.timeText}>
          {formatTime(shown)} / {formatTime(duration)}
        </Text>
      </View>
    </View>
  );
}

/** `formatTime` from the web's `shared/lib/time`: `h:mm:ss` only when there are hours. */
export function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = whole % 60;
  const padded = String(rest).padStart(2, "0");

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${padded}`
    : `${minutes}:${padded}`;
}

const makeStyles = (m: Metrics) =>
  StyleSheet.create({
    wrap: {
      position: "absolute",
      zIndex: 5,
      elevation: 5,
      flexDirection: "row",
      alignItems: "center",
      gap: m.space.meta,
    },
    /** A 24px band around the 10px bar, so a thumb can find it. */
    touch: { flex: 1, height: m.font(24), justifyContent: "center" },
    track: {
      height: m.font(10),
      borderRadius: 999,
      overflow: "hidden",
      backgroundColor: "rgba(255, 255, 255, 0.24)",
    },
    /**
     * The animated width is on this view and the gradient fills it, because a gradient
     * cannot be given a percentage width and keep its own start and end.
     */
    fill: { height: "100%", borderRadius: 999, overflow: "hidden" },
    gradient: { flex: 1 },
    timePill: {
      minWidth: m.font(78),
      paddingHorizontal: m.font(7),
      paddingVertical: m.font(3),
      borderRadius: 999,
      backgroundColor: "rgba(12, 12, 12, 0.72)",
    },
    timeText: {
      color: "#ffffff",
      fontSize: m.font(11),
      fontFamily: fonts.extrabold,
      textAlign: "center",
    },
  });
