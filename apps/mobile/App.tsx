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
import { ThemeProvider } from "./src/shared/lib/theme/use-theme";

/**
 * Held until the fonts are in.
 *
 * Nunito at 800 is what the card titles are; rendering them in the system face
 * first and swapping would reflow every card on the first screen. Keeping the
 * splash up until the fonts resolve trades a few hundred milliseconds for never
 * showing the wrong typeface.
 */
void SplashScreen.preventAutoHideAsync();

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  useEffect(() => {
    // A font that fails to load still has to let the app through — the fallback
    // face is worse than Nunito, and far better than a splash screen forever.
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontError, fontsLoaded]);

  const openVideo = useCallback((video: Video) => {
    // The watch screen is the next piece of work. Deliberately inert rather than
    // opening the site in a WebView: this app is being taken off WebView, and a
    // temporary one here would be the hardest kind of temporary to remove.
    console.log("open video", video.id);
  }, []);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar style="auto" />
        <HomeScreen
          videos={CURATED_UZBEK_OLD_CARTOONS}
          onOpenVideo={openVideo}
        />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
