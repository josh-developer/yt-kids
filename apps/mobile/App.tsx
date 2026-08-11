import { StatusBar } from "expo-status-bar";
import { StyleSheet } from "react-native";
import {
  SafeAreaProvider,
  SafeAreaView,
} from "react-native-safe-area-context";
import { SiteWebView } from "./src/site-web-view";

/**
 * The whole app: a status bar, a safe area, and the site.
 *
 * Only the top edge is inset. The site draws its own bottom-anchored player
 * controls and its own safe-area padding for them (`env(safe-area-inset-bottom)`
 * in the player styles), so insetting the bottom here as well would push
 * everything up by the home indicator twice over.
 */
export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <SafeAreaView style={styles.shell} edges={["top"]}>
        <SiteWebView />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: "#fff9e8",
  },
});
