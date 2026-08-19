// First, and before anything that formats a message: it patches `Intl` in place.
import "./src/shared/lib/i18n/intl-polyfill";
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
  Nunito_800ExtraBold,
  Nunito_900Black,
  useFonts,
} from "@expo-google-fonts/nunito";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Navigation } from "./src/app/navigation";
import { useLibrary } from "./src/entities/library";
import { DeviceProvider } from "./src/shared/lib/device/use-device";
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
    // Gesture Handler needs to own the root view for the watch sheet's drag to reach the
    // native side.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {/* Above the theme, because the palette does not depend on the device but every
            metric below does — and both have to be settled before the first paint. */}
        <DeviceProvider>
          <ThemeProvider>
            <LocaleProvider>
              <Shell />
            </LocaleProvider>
          </ThemeProvider>
        </DeviceProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Inside the providers, so it can wait on what they load, and outside the navigator, so
 * the library is one object rather than one per route.
 *
 * Where the screens go is `src/app/navigation.tsx`.
 */
function Shell() {
  const theme = useTheme();
  const locale = useLocale();
  const library = useLibrary();

  const [fontsLoaded, fontError] = useFonts({
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
    Nunito_800ExtraBold,
    Nunito_900Black,
  });

  // A font that fails to load still has to let the app through: the fallback face is worse
  // than Nunito and far better than a splash screen forever.
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

  if (!isReady) {
    return null;
  }

  return <Navigation library={library} />;
}
