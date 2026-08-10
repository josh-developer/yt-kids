import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import type {
  ShouldStartLoadRequest,
  WebViewNavigation,
} from "react-native-webview/lib/WebViewTypes";
import { isAllowedSiteUrl, SITE_URL } from "./config";

/** The site's own page background, so the gap before first paint is not a white flash. */
const CANVAS = "#fff9e8";
const INK = "#31475d";

export function SiteWebView() {
  const webViewRef = useRef<WebView>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasFailed, setHasFailed] = useState(false);
  // A ref as well as state: the back handler is registered once, and a value
  // captured in that render would go stale on the first navigation.
  const canGoBackRef = useRef(false);

  /**
   * Android's hardware back walks the site's history before it closes the app,
   * which is what makes in-app navigation feel native rather than like a page.
   * The web app routes with `history.pushState`, so its views are real entries.
   */
  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (!canGoBackRef.current) {
          return false;
        }

        webViewRef.current?.goBack();
        return true;
      },
    );

    return () => subscription.remove();
  }, []);

  const handleNavigationStateChange = useCallback(
    (state: WebViewNavigation) => {
      canGoBackRef.current = state.canGoBack;
    },
    [],
  );

  /**
   * The fence.
   *
   * On iOS this fires for subframes too, and the player is a cross-origin
   * iframe, so a subframe request goes through unchecked — running the check
   * there would block playback outright. Android reports only main-frame
   * navigations, where `isTopFrame` is absent and the check applies.
   */
  const handleShouldStartLoad = useCallback(
    (request: ShouldStartLoadRequest) => {
      if (request.isTopFrame === false) {
        return true;
      }

      return isAllowedSiteUrl(request.url);
    },
    [],
  );

  const reload = useCallback(() => {
    setHasFailed(false);
    setIsLoading(true);
    webViewRef.current?.reload();
  }, []);

  return (
    <View style={[styles.fill, styles.canvas]}>
      <WebView
        ref={webViewRef}
        source={{ uri: SITE_URL }}
        style={styles.fill}
        containerStyle={styles.canvas}
        onLoadStart={() => setIsLoading(true)}
        onLoadEnd={() => setIsLoading(false)}
        onNavigationStateChange={handleNavigationStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onError={() => setHasFailed(true)}
        // Video: play in place instead of being thrown into the system
        // fullscreen player, and do not demand a tap first. The web build has to
        // work around WebKit's muted-autoplay rule; in a shell we own, it lifts.
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsFullscreenVideo
        allowsBackForwardNavigationGestures
        // `target="_blank"` would otherwise open a window this shell cannot
        // police, and nothing in the app legitimately wants one.
        setSupportMultipleWindows={false}
        // A shell should not read as a document: no rubber-banding at the edges,
        // no accidental text selection.
        bounces={false}
        overScrollMode="never"
        textInteractionEnabled={false}
        webviewDebuggingEnabled={__DEV__}
      />

      {isLoading && !hasFailed ? (
        <View style={[styles.overlay, styles.canvas]} pointerEvents="none">
          <ActivityIndicator size="large" color={INK} />
        </View>
      ) : null}

      {hasFailed ? (
        <View style={[styles.overlay, styles.canvas, styles.centred]}>
          <Text style={styles.title}>No connection</Text>
          <Text style={styles.body}>KidTube could not be reached.</Text>
          <Pressable
            style={styles.button}
            onPress={reload}
            accessibilityRole="button"
          >
            <Text style={styles.buttonLabel}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  canvas: { backgroundColor: CANVAS },
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "center",
  },
  centred: { alignItems: "center", gap: 10, paddingHorizontal: 32 },
  title: { fontSize: 22, fontWeight: "800", color: INK },
  body: { fontSize: 15, color: INK, opacity: 0.7, textAlign: "center" },
  button: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 999,
    backgroundColor: "#ff3157",
  },
  buttonLabel: { color: "#ffffff", fontSize: 16, fontWeight: "800" },
});
