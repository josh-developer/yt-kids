import type { ReactNode } from "react";
import { TVFocusGuideView, View, type ViewStyle } from "react-native";
import { useDevice } from "../lib/device/use-device";

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
  trapLeft = false,
  trapRight = false,
  trapUp = false,
  trapDown = false,
}: {
  children: ReactNode;
  style?: ViewStyle;
  /** Send focus arriving on the zone to the first thing inside it. */
  autoFocus?: boolean;
  /** Keep focus in, on the given edge. A dialog traps all four. */
  trapLeft?: boolean;
  trapRight?: boolean;
  trapUp?: boolean;
  trapDown?: boolean;
}) {
  const { isTV } = useDevice();

  if (!isTV) {
    return <View style={style}>{children}</View>;
  }

  return (
    <TVFocusGuideView
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
