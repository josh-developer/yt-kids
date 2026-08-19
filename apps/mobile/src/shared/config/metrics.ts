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
 * How much larger the *boxes* are on each machine — padding, targets, icons, radii.
 *
 * Type does not use this. See {@link TYPE} for why the two had to come apart.
 */
const SCALE: Record<DeviceKind, number> = {
  phone: 1,
  tablet: 1.12,
  tv: 1.5,
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
type Size = Record<keyof typeof size | "tapTarget" | "focusRing", number>;
type Radius = Record<keyof typeof radius, number>;

const SPACE: Record<DeviceKind, Space> = {
  phone: space,
  tablet: { card: 10, meta: 13, gridGap: 20, screenX: 24 },
  tv: { card: 12, meta: 16, gridGap: 32, screenX: 48 },
};

/**
 * `focusRing` is the outline drawn around whatever the D-pad is currently on.
 *
 * It is not zero away from a television. A hardware keyboard moves focus on a phone and a
 * tablet too, and a control that gives no sign of being focused is a control nobody can
 * use that way. It is simply thinner there, because it sits closer to the eye.
 */
const SIZE: Record<DeviceKind, Size> = {
  // 42 is `.iconButton`'s width on the web, which is what every round control here is.
  phone: { ...size, tapTarget: 42, focusRing: 2 },
  tablet: {
    avatar: 44,
    brandMarkWidth: 58,
    topBarHeight: 72,
    tapTarget: 48,
    focusRing: 3,
  },
  // A focus target wants to be larger than a touch target, and its ring larger still.
  tv: {
    avatar: 56,
    brandMarkWidth: 76,
    topBarHeight: 88,
    tapTarget: 64,
    focusRing: 4,
  },
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

/**
 * The type ramp, per device — and a television's is written out rather than derived.
 *
 * It began as one multiplier over `theme.ts`, and that was wrong in a way only a real
 * television showed. The arithmetic: a phone card gets `390 - 2*12 - 2*8 = 350dp` of
 * content, while a television card, four across a 960dp panel, gets
 * `(960 - 2*48) / 4 - 2*12 = 192dp`. **The TV card is narrower in dp than the phone
 * card** — a bigger screen cut into more columns — so scaling every glyph by 1.5 put 1.5x
 * the text into 0.55x the width. Every channel name and view count on the grid ellipsised
 * mid-word.
 *
 * What a ten-foot design wants is a *steeper* ramp, not a uniform one: the title grows a
 * lot because it is what carries across the room, and the secondary lines grow a little
 * because they only have to be legible once something has your attention. So a television
 * gets its own set, sized against the box it has to fit rather than against a phone.
 *
 * The duration badge is the clearest case. The multiplier took it from 12 to 18, and a
 * `MIN_FONT_SIZE` floor — added to stop the smallest tokens vanishing — pinned it there.
 * On screen it was a black slab across a third of the thumbnail. It belongs at 13, and the
 * floor is gone with it.
 */
type TypeSet = Record<
  keyof typeof type,
  { fontFamily: string; fontSize: number; lineHeight: number }
>;

function scaleText(
  base: { fontFamily: string; fontSize: number; lineHeight: number },
  scale: number,
) {
  const fontSize = Math.round(base.fontSize * scale);

  return {
    fontFamily: base.fontFamily,
    fontSize,
    // The ratio is kept rather than the difference, so a scaled title keeps the leading
    // the web gave it instead of growing tighter as it grows larger.
    lineHeight: Math.round(fontSize * (base.lineHeight / base.fontSize)),
  };
}

function scaleSet(scale: number): TypeSet {
  return {
    cardTitle: scaleText(type.cardTitle, scale),
    muted: scaleText(type.muted, scale),
    duration: scaleText(type.duration, scale),
    brand: scaleText(type.brand, scale),
    avatar: scaleText(type.avatar, scale),
  };
}

const TYPE: Record<DeviceKind, TypeSet> = {
  phone: scaleSet(1),
  tablet: scaleSet(SCALE.tablet),
  tv: {
    /** Two lines of this is what a title gets in a 192dp card. */
    cardTitle: { fontFamily: fonts.extrabold, fontSize: 24, lineHeight: 30 },
    /** "Uzbek Multfilmlar" and "270.8K views" each fit on one line at this size. */
    muted: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22 },
    /** A badge in the corner of a thumbnail, not a headline. */
    duration: { fontFamily: fonts.extrabold, fontSize: 13, lineHeight: 16 },
    brand: { fontFamily: fonts.black, fontSize: 36, lineHeight: 40 },
    avatar: { fontFamily: fonts.black, fontSize: 20, lineHeight: 24 },
  },
};

function metricsFor(kind: DeviceKind) {
  const scale = SCALE[kind];

  return {
    kind,
    fonts,
    type: TYPE[kind],
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
    /** {@link scale}, rounded. For the one-off sizes that never became tokens. */
    font(base: number) {
      return Math.round(base * scale);
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
