import {
  createContext,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { Platform, useWindowDimensions } from "react-native";

/**
 * What the app is running on, along two axes that genuinely vary independently.
 *
 * A single `isTablet` flag cannot describe this app's targets. A Fire TV is a D-pad on a
 * large surface; an iPad is a finger on a large surface; a phone turned sideways is a
 * finger on a surface that is briefly wide. Collapsing those into one enum is how every
 * component ends up reading `Platform.isTV ? … : width > 900 ? …`, twenty times over and
 * each time slightly differently.
 *
 * So there are two:
 *
 * - {@link DeviceKind} — what the machine *is*, which does not change while the app runs.
 *   This drives *scale*: type size, target size, overscan. A phone's text must not grow
 *   because someone turned it sideways; the viewer did not move further away.
 * - {@link SizeClass} — how wide the window *currently is*, which changes on every
 *   rotation and every split-view resize. This drives *layout*: how many columns, whether
 *   two panes fit, whether the player can sit beside its recommendations.
 *
 * Keeping them apart is what lets a phone in landscape get the two-column grid it has the
 * room for without also getting a tablet's type scale.
 */
export type DeviceKind = "phone" | "tablet" | "tv";

/**
 * The window's width class, on Material 3's breakpoints — the same numbers Android's own
 * `WindowSizeClass` uses, so the app agrees with the platform it is laid out on.
 *
 * `tv` is not a width; see {@link deviceKindFor}.
 */
export type SizeClass = "compact" | "regular" | "expanded" | "tv";

/** Material 3's medium breakpoint. Below it, a card gets the whole width. */
const REGULAR_MIN_WIDTH = 600;
/** Material 3's expanded breakpoint, and the width at which two panes stop being cramped. */
const EXPANDED_MIN_WIDTH = 840;
/**
 * A device whose *shortest* side is at least this is a tablet.
 *
 * The shortest side rather than the current width, because this is an identity and has to
 * survive a rotation: a phone is 390×844, so its short side is 390 whichever way up it is,
 * while a 10-inch tablet is 800×1280 and never drops below 800.
 */
const TABLET_MIN_SHORT_SIDE = 600;

export type Device = {
  kind: DeviceKind;
  sizeClass: SizeClass;
  /** A D-pad, or a finger. Every gesture and every hit target follows from this. */
  input: "pointer" | "focus";
  isTV: boolean;
  /** Whether two panes fit beside each other — a wide window, on any device. */
  isWide: boolean;
  /** The window, so a consumer that needs the raw number does not subscribe a second time. */
  width: number;
  height: number;
};

/**
 * Which machine this is.
 *
 * `Platform.isTV` is the platform's own answer rather than a guess from the dimensions: on
 * Android it reads `UiModeManager`'s `UI_MODE_TYPE_TELEVISION` and on iOS the interface
 * idiom. It exists on stock React Native, so this file is already correct on today's phone
 * build, before any TV variant is configured.
 *
 * That it is asked *first* is the part that matters. **A television must never be inferred
 * from a width.** A 1080p Android TV reports 960×540dp at density 2.0, and most 4K
 * hardware reports the same — narrower than a modern tablet and barely wider than a phone
 * in landscape. Width-derived layout would hand a television a three-column grid sized to
 * be read at arm's length.
 */
function deviceKindFor(shortestSide: number): DeviceKind {
  if (Platform.isTV) {
    return "tv";
  }

  return shortestSide >= TABLET_MIN_SHORT_SIDE ? "tablet" : "phone";
}

function sizeClassFor(kind: DeviceKind, width: number): SizeClass {
  if (kind === "tv") {
    return "tv";
  }

  if (width >= EXPANDED_MIN_WIDTH) {
    return "expanded";
  }

  return width >= REGULAR_MIN_WIDTH ? "regular" : "compact";
}

const DeviceContext = createContext<Device | null>(null);

/**
 * Computed once, above the navigator, so a rotation is one re-render at the root rather
 * than every screen calling `useWindowDimensions` separately and arriving at the same
 * answer.
 */
export function DeviceProvider({ children }: { children: ReactNode }) {
  const { width, height } = useWindowDimensions();

  const value = useMemo<Device>(() => {
    const kind = deviceKindFor(Math.min(width, height));
    const sizeClass = sizeClassFor(kind, width);

    return {
      kind,
      sizeClass,
      input: kind === "tv" ? "focus" : "pointer",
      isTV: kind === "tv",
      // A television is always wide; it is the one size class that is not a width.
      isWide: sizeClass === "expanded" || sizeClass === "tv",
      width,
      height,
    };
  }, [height, width]);

  return (
    <DeviceContext.Provider value={value}>{children}</DeviceContext.Provider>
  );
}

export function useDevice() {
  const value = useContext(DeviceContext);
  if (!value) {
    throw new Error("useDevice must be used inside a DeviceProvider");
  }

  return value;
}
