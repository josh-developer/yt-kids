import { CURATED_UZBEK_OLD_CARTOONS } from "@repo/catalog";
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
import { useCallback, useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { HomeScreen } from "./src/pages/home/ui/home-screen";
import { LocaleProvider, useLocale } from "./src/shared/lib/i18n/use-translations";
import { ThemeProvider, useTheme } from "./src/shared/lib/theme/use-theme";

/**
 * Held until the fonts, the stored theme and the stored locale are all in.
 *
 * Each would otherwise show the wrong thing first and correct itself: the system
 * face before Nunito reflows every card title, light before a stored dark, English
 * before a stored Uzbek. A few hundred milliseconds of splash buys a first frame
 * that is simply right.
 */
void SplashScreen.preventAutoHideAsync();

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LocaleProvider>
          <Shell />
        </LocaleProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/**
 * Inside the providers, so it can wait on what they load. `StatusBar` reads the
 * theme, which is why it is here rather than in `App`.
 */
function Shell() {
  const theme = useTheme();
  const locale = useLocale();
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  // A font that fails to load still has to let the app through: the fallback face
  // is worse than Nunito and far better than a splash screen forever.
  const isReady = (fontsLoaded || fontError !== null) && theme.isReady && locale.isReady;

  useEffect(() => {
    if (isReady) {
      void SplashScreen.hideAsync();
    }
  }, [isReady]);

  const openVideo = useCallback((video: Video) => {
    // The watch screen is the next piece of work. Deliberately inert rather than
    // opening the site in a WebView: this app is being taken off WebView, and a
    // temporary one here would be the hardest kind of temporary to remove.
    console.log("open video", video.id);
  }, []);

  const openSettings = useCallback(() => {
    // Same: the parent settings screen is its own screen, not a link out.
    console.log("open settings");
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <>
      {/* Follows the palette rather than the OS, so a viewer who chose light in a
          dark system still gets dark status-bar glyphs. */}
      <StatusBar style={theme.name === "dark" ? "light" : "dark"} />
      <HomeScreen
        videos={CURATED_UZBEK_OLD_CARTOONS}
        onOpenVideo={openVideo}
        onSettings={openSettings}
      />
    </>
  );
}
