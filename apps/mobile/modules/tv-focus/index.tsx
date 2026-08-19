import { requireNativeView } from "expo";
import { Platform, View, type ViewProps } from "react-native";

/**
 * Android only. Everywhere else this file resolves to a plain `View`, so a caller never
 * has to branch — see the module's Kotlin for what it does and why.
 */
const NativeFocusBlocker =
  Platform.OS === "android"
    ? requireNativeView<ViewProps>("TVFocus")
    : null;

/**
 * Wraps a subtree that must never take D-pad focus.
 *
 * The player's WebView is the only user, and the reason is in
 * `modules/tv-focus/android/.../TVFocusModule.kt`: an Android TV WebView takes focus,
 * swallows the arrow keys, and leaves the remote doing nothing.
 */
export function FocusBlocker(props: ViewProps) {
  if (!NativeFocusBlocker) {
    return <View {...props} />;
  }

  return <NativeFocusBlocker {...props} />;
}
