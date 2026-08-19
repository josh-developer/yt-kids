import { useCallback, useMemo, useState } from "react";
import {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

/**
 * A press sinks; a focus lifts. Both are the same 1-to-0 spring underneath.
 */
const SINK = { damping: 20, stiffness: 400 };
const RELEASE = { damping: 20, stiffness: 300 };

/**
 * What a control does when a finger presses it or a D-pad lands on it.
 *
 * The two are one hook rather than two because they are the same acknowledgement of the
 * same thing — "this is the control you are about to act on" — arriving through different
 * hardware, and every control in the app needs both. A phone press already had a scale
 * animation; a television needs the inverse of it, and a ring, and nothing else changes.
 *
 * **Focus is React state, and the press is a shared value.** That split is deliberate.
 * A press animates while a finger is moving, so it belongs on the UI thread. Focus moves
 * once per D-pad click — a handful of times a second at the very most — so a re-render is
 * cheap and it buys the ring a plain conditional style rather than an animated
 * `borderColor`, which Reanimated can do and which nothing here needs.
 *
 * `onFocus` and `onBlur` are not television-only. A hardware keyboard moves focus on a
 * phone and a tablet as well, and a control that never acknowledges it is a control nobody
 * can use that way; the ring is simply thinner there. Nothing has to branch on the device.
 */
export function useFocusable({
  /** How far a press sinks. The card's 2% is subtler than a button's 6%. */
  pressDepth = 0.06,
  /** How far focus lifts. Larger than the press, because it must read across a room. */
  focusLift = 0.08,
}: { pressDepth?: number; focusLift?: number } = {}) {
  const pressed = useSharedValue(0);
  const focused = useSharedValue(0);
  const [isFocused, setIsFocused] = useState(false);

  /* eslint-disable react-hooks/immutability -- Reanimated shared-value writes. */
  const onPressIn = useCallback(() => {
    pressed.value = withSpring(1, SINK);
  }, [pressed]);

  const onPressOut = useCallback(() => {
    pressed.value = withSpring(0, RELEASE);
  }, [pressed]);

  const onFocus = useCallback(() => {
    focused.value = withSpring(1, SINK);
    setIsFocused(true);
  }, [focused]);

  const onBlur = useCallback(() => {
    focused.value = withSpring(0, RELEASE);
    setIsFocused(false);
  }, [focused]);
  /* eslint-enable react-hooks/immutability */

  const style = useAnimatedStyle(() => ({
    transform: [
      { scale: 1 - pressed.value * pressDepth + focused.value * focusLift },
    ],
  }));

  const handlers = useMemo(
    () => ({ onPressIn, onPressOut, onFocus, onBlur }),
    [onBlur, onFocus, onPressIn, onPressOut],
  );

  return { handlers, style, isFocused };
}

/**
 * The ring itself, as a style to spread onto the focused view.
 *
 * A border rather than a shadow: a shadow is clipped by `overflow: hidden` on anything
 * that rounds its corners, which is most of what gets focused here, and Android draws it
 * as an elevation that reorders the view against its siblings.
 *
 * Transparent rather than absent when unfocused, so the border is always in the layout and
 * the control does not jump by its own width the moment focus arrives.
 */
export function focusRing(width: number, color: string, isFocused: boolean) {
  return {
    borderWidth: width,
    borderColor: isFocused ? color : "transparent",
  } as const;
}
