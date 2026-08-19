import { useMemo } from "react";
import { fonts, radius, size, space, type } from "./theme";
import { useDevice, type DeviceKind } from "../lib/device/use-device";

/**
 * The design tokens, at the size the machine in front of the viewer needs them.
 *
 * `theme.ts` stays exactly what it was — the phone's values, copied from the web app's
 * `globals.css` and greppable against it, which `ARCHITECTURE.md` names as the invariant.
 * This file derives the other two devices from it rather than replacing it, so a token
 * corrected on the web is still corrected here in one place.
 *
 * Scale is keyed to {@link DeviceKind}, not to the window's width. That distinction is the
 * whole reason `use-device.tsx` has two axes: a phone turned sideways gets a wider
 * *layout*, because it has the room, and keeps its *type size*, because the viewer did not
 * move further away. Only a genuinely different machine is read from a different distance.
 */
export type Metrics = ReturnType<typeof metricsFor>;

/**
 * How much larger everything is on each machine.
 *
 * 1.5 for a television is the ratio that puts a card title at roughly 2.5% of the screen's
 * width — the proportion the platform's own launcher and YouTube's TV client both settle
 * near — once a 1080p panel's 960dp coordinate space is accounted for. It is a viewing
 * distance expressed as a number, not a guess: ten feet away is about ten times a phone's
 * reading distance across a screen about ten times as wide, so what has to grow is the
 * fraction of the screen a glyph occupies, and it only has to grow a little.
 */
const SCALE: Record<DeviceKind, number> = {
  phone: 1,
  tablet: 1.12,
  tv: 1.5,
};

/**
 * No glyph goes below this, whatever the scale arithmetic says.
 *
 * The duration badge is the reason. It is 12px on a phone, which a multiplier alone turns
 * into 18px on a television — legible on a desk and not from a sofa. A floor is the honest
 * fix; raising the multiplier to suit the smallest token would oversize every other one.
 */
const MIN_FONT_SIZE: Record<DeviceKind, number> = {
  phone: 0,
  tablet: 0,
  tv: 18,
};

/**
 * Spacing is listed per device rather than scaled, because the values do not move together.
 *
 * `screenX` quadruples from phone to television while `card` padding barely doubles: the
 * margin is answering overscan and the reach of a focus ring, and the padding is answering
 * the same relationship between a picture and its frame it always was.
 */
/** The tokens are `as const` in `theme.ts`, so each field has to be widened to a number. */
type Space = Record<keyof typeof space, number>;
type Size = Record<keyof typeof size | "tapTarget", number>;
type Radius = Record<keyof typeof radius, number>;

const SPACE: Record<DeviceKind, Space> = {
  phone: space,
  tablet: { card: 10, meta: 13, gridGap: 20, screenX: 24 },
  tv: { card: 12, meta: 16, gridGap: 32, screenX: 48 },
};

const SIZE: Record<DeviceKind, Size> = {
  // 42 is `.iconButton`'s width on the web, which is what every round control here is.
  phone: { ...size, tapTarget: 42 },
  tablet: { avatar: 44, brandMarkWidth: 58, topBarHeight: 72, tapTarget: 48 },
  // A focus target wants to be larger than a touch target, and its ring larger still.
  tv: { avatar: 56, brandMarkWidth: 76, topBarHeight: 88, tapTarget: 64 },
};

const RADIUS: Record<DeviceKind, Radius> = {
  phone: radius,
  tablet: { card: 10, thumbnail: 10, duration: 5, avatar: 22, brandMark: 15, sheet: 24 },
  tv: { card: 12, thumbnail: 12, duration: 6, avatar: 28, brandMark: 18, sheet: 28 },
};

/**
 * The vertical overscan a television needs, and nothing else does.
 *
 * **`useSafeAreaInsets()` returns zeroes on a television** — there is no notch and no home
 * indicator to report — and yet a large share of sets still crop the outer few percent of
 * the picture. Android TV's guidance is a 5% horizontal and 3% vertical margin, which at
 * 960×540dp is 48 and 27.
 *
 * Only the vertical half is here. The horizontal half is already carried by
 * `space.screenX`, which is 48 on a television precisely because a content gutter and an
 * overscan margin are the same measurement on a screen with no edges to speak of. Holding
 * both would pad the sides twice.
 */
const OVERSCAN_Y: Record<DeviceKind, number> = {
  phone: 0,
  tablet: 0,
  tv: 27,
};

function scaleText(
  base: { fontFamily: string; fontSize: number; lineHeight: number },
  scale: number,
  minFontSize: number,
) {
  const fontSize = Math.round(Math.max(base.fontSize * scale, minFontSize));

  return {
    fontFamily: base.fontFamily,
    fontSize,
    // The ratio is kept rather than the difference, so a scaled title keeps the leading
    // the web gave it instead of growing tighter as it grows larger.
    lineHeight: Math.round(fontSize * (base.lineHeight / base.fontSize)),
  };
}

function metricsFor(kind: DeviceKind) {
  const scale = SCALE[kind];
  const minFontSize = MIN_FONT_SIZE[kind];

  return {
    kind,
    fonts,
    type: {
      cardTitle: scaleText(type.cardTitle, scale, minFontSize),
      muted: scaleText(type.muted, scale, minFontSize),
      duration: scaleText(type.duration, scale, minFontSize),
      brand: scaleText(type.brand, scale, minFontSize),
      avatar: scaleText(type.avatar, scale, minFontSize),
    },
    space: SPACE[kind],
    size: SIZE[kind],
    radius: RADIUS[kind],
    overscanY: OVERSCAN_Y[kind],
    /**
     * For the handful of one-off sizes that live inline in a component — an icon's `size`
     * prop, a row thumbnail's width — where lifting them into a token would be a token
     * used once.
     */
    scale,
    /** As {@link scale}, but never letting a glyph fall under the floor. */
    font(base: number) {
      return Math.round(Math.max(base * scale, minFontSize));
    },
  };
}

/**
 * All three, built once at module load.
 *
 * Which means {@link useMetrics} returns a referentially stable object — the same one for
 * the life of the process on any given device — so a `useMemo` keyed on it never
 * recomputes, and the style sheets built from it are created once rather than per render.
 */
const METRICS: Record<DeviceKind, Metrics> = {
  phone: metricsFor("phone"),
  tablet: metricsFor("tablet"),
  tv: metricsFor("tv"),
};

export function useMetrics(): Metrics {
  return METRICS[useDevice().kind];
}

/**
 * A component's style sheet, built for the device it is on.
 *
 * `factory` must be defined at module scope — a `const makeStyles = (m: Metrics) =>
 * StyleSheet.create({…})` beside the component, exactly where its `StyleSheet.create` used
 * to be. That is what makes it a stable identity, and with metrics stable too the memo
 * hits on every render after the first: at most three sheets are ever created per
 * component, and in practice one, because a device is only ever one kind.
 */
export function useStyles<T>(factory: (metrics: Metrics) => T): T {
  const metrics = useMetrics();
  return useMemo(() => factory(metrics), [factory, metrics]);
}
