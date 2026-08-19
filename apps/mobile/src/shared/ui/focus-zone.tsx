import { useCallback, useRef, type ReactNode } from "react";
import {
  TVFocusGuideView,
  View,
  type FocusGuideMethods,
  type ViewStyle,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useDevice } from "../lib/device/use-device";

/**
 * How long to wait before asking for focus back.
 *
 * A screen regains navigation focus while the view underneath it is still being
 * reattached, and a focus request on a view that is not yet in the hierarchy does
 * nothing. One frame is not reliably enough on a slower box; this is.
 */
const RECLAIM_DELAY_MS = 50;

/**
 * A region the D-pad can find its way into, and a plain `View` everywhere else.
 *
 * Android's focus search works geometrically: pressing down looks for a focusable view
 * below the current one. That falls apart at the seams of this app — the header floats
 * *over* the list rather than above it in the layout, and the list is virtualised, so the
 * view that ought to receive focus is frequently not mounted yet. `TVFocusGuideView` is
 * the platform's answer: focus landing anywhere on the guide is redirected to something
 * focusable inside it.
 *
 * Branching on the device rather than rendering it everywhere, because on a phone it is a
 * native view in the tree that nothing will ever use.
 */
export function FocusZone({
  children,
  style,
  autoFocus = true,
  reclaimFocus = false,
  trapLeft = false,
  trapRight = false,
  trapUp = false,
  trapDown = false,
}: {
  children: ReactNode;
  style?: ViewStyle;
  /** Send focus arriving on the zone to the first thing inside it. */
  autoFocus?: boolean;
  /**
   * Ask for focus whenever the screen this zone is on comes back to the front.
   *
   * Watch is a transparent modal over the home screen, so closing it does not remount
   * anything — which means `hasTVPreferredFocus`, read once at mount, never fires again.
   * Measured on a TV emulator: after backing out of a video, nothing on the grid held
   * focus and the remote was inert until something else claimed it. This is the claim.
   */
  reclaimFocus?: boolean;
  /** Keep focus in, on the given edge. A dialog traps all four. */
  trapLeft?: boolean;
  trapRight?: boolean;
  trapUp?: boolean;
  trapDown?: boolean;
}) {
  const { isTV } = useDevice();
  const guide = useRef<View & FocusGuideMethods>(null);

  useFocusEffect(
    useCallback(() => {
      if (!isTV || !reclaimFocus) {
        return;
      }

      const timer = setTimeout(
        () => guide.current?.requestTVFocus(),
        RECLAIM_DELAY_MS,
      );

      return () => clearTimeout(timer);
    }, [isTV, reclaimFocus]),
  );

  if (!isTV) {
    return <View style={style}>{children}</View>;
  }

  return (
    <TVFocusGuideView
      ref={guide}
      style={style}
      autoFocus={autoFocus}
      trapFocusLeft={trapLeft}
      trapFocusRight={trapRight}
      trapFocusUp={trapUp}
      trapFocusDown={trapDown}
    >
      {children}
    </TVFocusGuideView>
  );
}
