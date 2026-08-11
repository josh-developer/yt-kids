// First, and before anything that formats a message: it patches `Intl` in place.
import "./src/shared/lib/i18n/intl-polyfill";
import type { Video } from "@repo/catalog/types";
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts,
} from "@expo-google-fonts/nunito";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useLibrary } from "./src/entities/library";
import { HomeScreen } from "./src/pages/home/ui/home-screen";
import { SettingsScreen } from "./src/pages/settings/ui/settings-screen";
import { WatchSheet } from "./src/pages/watch/ui/watch-sheet";
import {
  LocaleProvider,
  useLocale,
} from "./src/shared/lib/i18n/use-translations";
import { ThemeProvider, useTheme } from "./src/shared/lib/theme/use-theme";

/**
 * Held until the fonts, the stored theme, the stored locale and the library are in.
 *
 * Each would otherwise show the wrong thing first and correct itself: the system face
 * before Nunito reflows every card title, light before a stored dark, English before a
 * stored Uzbek, the whole catalog before a parent's hidden videos are read back.
 */
void SplashScreen.preventAutoHideAsync();

export default function App() {
  return (
    // Gesture Handler needs to own the root view for the watch sheet's drag to reach
    // the native side.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <LocaleProvider>
            <Shell />
          </LocaleProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/** Which screen is showing. The watch sheet is not one: it sits over whatever is. */
type Screen = "home" | "settings";

/**
 * Inside the providers, so it can wait on what they load.
 *
 * Navigation is two pieces of state rather than a router. There are two screens and a
 * sheet, all of which have to be mounted at once for the sheet to slide over the
 * screen behind it — a router would add a dependency and a stack to fight for exactly
 * that. It is worth revisiting when there is a third screen or a deep link.
 */
function Shell() {
  const theme = useTheme();
  const locale = useLocale();
  const library = useLibrary();
  const [screen, setScreen] = useState<Screen>("home");
  const [watching, setWatching] = useState<Video | null>(null);
  const [query, setQuery] = useState("");

  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  // A font that fails to load still has to let the app through: the fallback face is
  // worse than Nunito and far better than a splash screen forever.
  const isReady =
    (fontsLoaded || fontError !== null) &&
    theme.isReady &&
    locale.isReady &&
    library.isReady;

  useEffect(() => {
    if (isReady) {
      void SplashScreen.hideAsync();
    }
  }, [isReady]);

  const visibleVideos = useMemo(() => library.feed(query), [library, query]);

  const openVideo = useCallback((video: Video) => setWatching(video), []);
  const closeVideo = useCallback(() => setWatching(null), []);

  if (!isReady) {
    return null;
  }

  return (
    <>
      {/* Follows the palette rather than the OS, so a viewer who chose light in a dark
          system still gets dark status-bar glyphs. The sheet's player is always dark
          behind the status bar, so it asks for light glyphs regardless. */}
      <StatusBar style={watching || theme.name === "dark" ? "light" : "dark"} />

      {screen === "home" ? (
        <HomeScreen
          videos={visibleVideos}
          query={query}
          onQueryChange={setQuery}
          onOpenVideo={openVideo}
          onSettings={() => setScreen("settings")}
        />
      ) : (
        <SettingsScreen library={library} onBack={() => setScreen("home")} />
      )}

      {watching ? <WatchSheet video={watching} onClose={closeVideo} /> : null}
    </>
  );
}
