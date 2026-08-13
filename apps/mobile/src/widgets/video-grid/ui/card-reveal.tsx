import type { ReactNode } from "react";
import { StyleSheet } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

/** Long enough to read as an arrival, short enough not to be in the way of a flick. */
const DURATION = 240;
/** Staggered by position in the row, so cards in a row arrive left to right. */
const STAGGER = 40;

/**
 * Reveals a card as it arrives.
 *
 * This used to be driven by scroll position: every mounted card read the list's `scrollY`
 * in its own `useAnimatedStyle`, which described where the card actually was and so
 * survived recycling perfectly. It also meant one worklet per mounted card per frame —
 * a dozen or more style commits every frame of every scroll — and on a mid-range phone
 * that is what "scrolling feels heavy" is made of.
 *
 * Reanimated's `entering` runs the animation natively from the mount instead: no shared
 * value, no per-frame work, nothing left running once the card has arrived. The cost is
 * honest and small — a row scrolled back to animates again, because virtualisation
 * remounts it — and it buys a list that keeps up with a fast flick.
 */
export function CardReveal({
  children,
  column,
}: {
  children: ReactNode;
  /** Which cell of its row this is, which is all the stagger needs. */
  column: number;
}) {
  return (
    <Animated.View
      style={styles.card}
      entering={FadeInDown.duration(DURATION)
        .delay(column * STAGGER)
        .withInitialValues({ transform: [{ translateY: 14 }] })}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1 },
});
