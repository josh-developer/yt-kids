import {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";

/** Within this much of the top the bar is always shown. */
const TOP_ZONE = 24;
/** Ignore anything smaller, so a jittery finger does not flicker the bar. */
const HIDE_DELTA = 8;
/** `transition: transform 180ms ease` on `.topbar`. */
const DURATION = 180;

/**
 * Hides the bar while scrolling down, brings it back on any upward scroll.
 *
 * A port of `useTopbarAutoHide` from the web, thresholds included — 24px of top zone
 * and an 8px deadband, which is what stops a jittery finger flickering it — so the
 * bar behaves the same on both.
 *
 * The whole thing lives on the UI thread. The web reads `window.scrollY` in a
 * listener and flips a class; doing the equivalent here with React state would mean
 * a `setState` per scroll frame, putting a header animation on the JS thread, which
 * is precisely where it must not be.
 *
 * `useAnimatedReaction` rather than a derived value, because the decision needs the
 * *previous* offset to get a direction from — a derived value only ever sees the
 * current one, and the delta would be zero every frame.
 */
export function useAutoHideStyle(
  scrollY: SharedValue<number>,
  barHeight: number,
) {
  const isHidden = useSharedValue(false);

  useAnimatedReaction(
    () => scrollY.value,
    (current, previous) => {
      // No previous offset on the first run: nothing to compare, so nothing to do.
      if (previous === null) {
        return;
      }

      const delta = current - previous;

      if (current < TOP_ZONE) {
        isHidden.value = false;
      } else if (delta > HIDE_DELTA) {
        isHidden.value = true;
      } else if (delta < -HIDE_DELTA) {
        isHidden.value = false;
      }
      // Between the thresholds it holds, which is the deadband.
    },
  );

  return useAnimatedStyle(() => ({
    transform: [
      {
        translateY: withTiming(isHidden.value ? -barHeight : 0, {
          duration: DURATION,
        }),
      },
    ],
  }));
}
