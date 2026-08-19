package expo.modules.tvfocus

import android.content.Context
import android.view.ViewGroup
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.views.ExpoView

/**
 * A view whose children can never hold focus.
 *
 * It exists for one thing: the WebView the player runs in. On Android TV a WebView is
 * focusable, and once the D-pad is inside it the arrow keys belong to the YouTube iframe —
 * its own controls, its own title bar, its own way out of the app — instead of to the
 * player chrome. Worse, the keys never reach React Native's root view, so
 * `useTVEventHandler` stops firing and the remote does nothing at all.
 *
 * Measured on an Android TV emulator before this existed: `uiautomator` reported
 * `android.webkit.WebView focusable=true focused=true bounds=[0,0][1920,1080]`, and
 * pressing up brought up no controls.
 *
 * The JavaScript side already asks for this — `focusable={false}` on the `WebView` — and
 * `react-native-webview` does not forward the prop to its native view. Even if it did, a
 * WebView reasserts focus on its own as pages and frames load. Blocking it from the parent
 * is the version that holds: `FOCUS_BLOCK_DESCENDANTS` is checked by
 * `View.hasAncestorThatBlocksDescendantFocus()`, so it defeats focus search and a direct
 * `requestFocus()` alike.
 *
 * This is the native half of the same fence the page's `#shield` div provides for touches.
 */
class FocusBlockerView(context: Context, appContext: AppContext) :
  ExpoView(context, appContext) {
  init {
    descendantFocusability = ViewGroup.FOCUS_BLOCK_DESCENDANTS
    isFocusable = false
    isFocusableInTouchMode = false
  }
}

class TVFocusModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("TVFocus")

    View(FocusBlockerView::class) {}
  }
}
