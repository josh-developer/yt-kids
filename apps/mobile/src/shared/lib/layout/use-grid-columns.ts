import { useMetrics } from "../../config/metrics";
import { useDevice, type SizeClass } from "../device/use-device";

/**
 * Past this width a class gets one more column than its base.
 *
 * It is the only width this file reads. Everything else is the size class, which has
 * already done the reading — see `use-device.tsx` for why a television in particular must
 * not be sized from its width.
 */
const ROOMY_MIN_WIDTH = 1200;

/**
 * How many columns of cards, and how far apart.
 *
 * This used to reproduce the web's CSS grid arithmetic — `repeat(auto-fill, minmax(260px,
 * 1fr))` worked out by hand — which was the right answer while the only two cases were a
 * phone upright and a phone turned sideways. It stops being the right answer the moment a
 * television is in scope: `auto-fill` divides the *viewport*, and a 1080p panel reports a
 * 960dp viewport, so the same arithmetic that gives a tablet three sensible columns gives a
 * television three columns of tablet-sized cards to be read from a sofa.
 *
 * So the count comes from the size class instead, which knows the difference between a wide
 * window and a distant one.
 *
 * | Class      | Columns              |
 * | ---------- | -------------------- |
 * | `compact`  | 1                    |
 * | `regular`  | 2                    |
 * | `expanded` | 3, or 4 when roomy   |
 * | `tv`       | 4, or 5 when roomy   |
 *
 * Four across a television's 960dp, less the 96dp of overscan margin, is a 216dp card —
 * 432 physical pixels on a 1080p panel, which is the size a thumbnail has to be to read
 * across a room.
 */
const BASE_COLUMNS: Record<SizeClass, number> = {
  compact: 1,
  regular: 2,
  expanded: 3,
  tv: 4,
};

export function useGridColumns() {
  const { sizeClass, width } = useDevice();
  const { space } = useMetrics();

  const base = BASE_COLUMNS[sizeClass];
  // A compact window is one column however wide the device claims to be; there is nothing
  // roomy about it.
  const columns =
    sizeClass !== "compact" && width >= ROOMY_MIN_WIDTH ? base + 1 : base;

  // The gap is the device's own — 16 on a phone, 20 on a tablet, 32 on a television — so
  // it grows with the cards rather than leaving them crowded at four across.
  return { columns, gap: space.gridGap };
}
