import { useWindowDimensions } from "react-native";
import { space } from "../../config/theme";

/**
 * The web's grid breakpoints, as a column count.
 *
 * `video-grid.module.css` is a CSS grid: one column below 720px, then
 * `repeat(auto-fill, minmax(260px, 1fr))`, then `minmax(420px, 1fr)` past 1081px.
 * `auto-fill` with a `minmax` floor is just "as many columns as fit at that
 * minimum", which is the arithmetic below — so a phone gets one column, a tablet
 * or a rotated phone gets the same layout the browser would give it at that width
 * rather than one absurdly large card.
 *
 * Worth having even though the first target is a phone: `orientation` is
 * `default`, so a rotation reaches the 720px branch immediately.
 */
const PHONE_MAX = 720;
const WIDE_MIN = 1081;
const CARD_MIN = 260;
const WIDE_CARD_MIN = 420;

export function useGridColumns() {
  const { width } = useWindowDimensions();

  if (width <= PHONE_MAX) {
    return { columns: 1, gap: space.gridGap };
  }

  const floor = width >= WIDE_MIN ? WIDE_CARD_MIN : CARD_MIN;
  const usable = width - space.screenX * 2;
  // `auto-fill` never drops below one column however narrow the viewport.
  const columns = Math.max(1, Math.floor(usable / floor));

  // `gap: 28px 18px` at the middle breakpoint, `16px` past 1081px.
  return { columns, gap: width >= WIDE_MIN ? 16 : 18 };
}
