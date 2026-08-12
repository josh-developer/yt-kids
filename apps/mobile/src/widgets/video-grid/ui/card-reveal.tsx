import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from "react-native-reanimated";

/** How far below the fold a card starts easing in, in points. */
const RUNWAY = 120;

/**
 * Reveals a card as it comes up into the viewport.
 *
 * Driven by scroll position rather than by a mount animation, which matters for a
 * virtualised list: rows mount when the windowing logic decides to, not when they
 * become visible, so a mount-triggered fade plays at the wrong moment — often
 * offscreen, so the viewer sees nothing, or twice for a row that gets recycled.
 * Reading position instead means the animation always describes where the card
 * actually is, and a row scrolled back to is already settled rather than fading in
 * again.
 *
 * `scrollY` is a shared value and every frame of this runs on the UI thread, so
 * the reveal keeps up with a fast flick even while images are decoding.
 */
export function CardReveal({
  children,
  index,
  scrollY,
  cardHeight,
  headerHeight,
  viewportHeight,
}: {
  children: ReactNode;
  index: number;
  scrollY: SharedValue<number>;
  cardHeight: number;
  /** Every card is pushed down by the list header; without it this is off by exactly that. */
  headerHeight: number;
  viewportHeight: number;
}) {
  const animated = useAnimatedStyle(() => {
    // Where this card's top sits relative to the bottom of the viewport.
    const cardTop = headerHeight + index * cardHeight;
    const distanceBelowFold = cardTop - (scrollY.value + viewportHeight);

    // 1 while the card is still below the fold, 0 once it has fully arrived.
    const progress = interpolate(
      distanceBelowFold,
      [-RUNWAY, RUNWAY],
      [0, 1],
      Extrapolation.CLAMP,
    );

    return {
      opacity: 1 - progress,
      transform: [
        { translateY: progress * 28 },
        { scale: 1 - progress * 0.04 },
      ],
    };
  });

  return (
    <Animated.View style={[styles.row, animated]}>{children}</Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { width: "100%" },
});
