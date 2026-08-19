import type { Video } from "@repo/catalog/types";
import { NavigationContainer, type Theme } from "@react-navigation/native";
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from "@react-navigation/native-stack";
import { useCallback, useMemo, useState } from "react";
import type { LibraryController } from "../entities/library";
import { HomeScreen } from "../pages/home/ui/home-screen";
import { SearchScreen } from "../pages/search/ui/search-screen";
import { SettingsScreen } from "../pages/settings/ui/settings-screen";
import { WatchSheet } from "../pages/watch/ui/watch-sheet";
import { useTheme } from "../shared/lib/theme/use-theme";

/**
 * The app's routes, and what each one needs.
 *
 * `Watch` carries the video rather than an id: the sheet needs its title, channel and
 * thumbnail immediately, and looking those up from a parameter would be work to
 * reproduce what the caller already had in its hand.
 */
export type Routes = {
  Home: undefined;
  /**
   * Search, which exists for the television: a TV keyboard covers the picture, so the
   * results need a screen the keyboard can get out of the way of. A phone reaches the same
   * filtering through the field in its own header and never comes here.
   */
  Search: undefined;
  Settings: undefined;
  Watch: { video: Video };
};

const Stack = createNativeStackNavigator<Routes>();

/**
 * Navigation, on the platform's own stack.
 *
 * This was two pieces of `useState` in `App.tsx`. That worked and was the wrong shape: the
 * back gesture and the hardware back button had to be reimplemented, every screen stayed
 * mounted whether or not it was visible, and there was nowhere for a deep link to arrive.
 *
 * `createNativeStackNavigator` is backed by `react-native-screens`, so a route that is not
 * on top is *detached* from the view hierarchy rather than merely hidden — which is the
 * part that matters here: the home grid stops existing while settings is up, instead of
 * sitting behind it holding a few hundred rows.
 *
 * The watch route is a transparent modal with the stack's animation switched off. See-
 * through because the sheet slides over whatever is behind it, and unanimated because the
 * sheet animates itself; two animations on one transition is how a slide turns into a
 * stutter.
 */
export function Navigation({ library }: { library: LibraryController }) {
  const { colors, name } = useTheme();

  const theme = useMemo<Theme>(
    () => ({
      dark: name === "dark",
      colors: {
        primary: colors.brandRed,
        background: colors.kidBgTop,
        card: colors.surface,
        text: colors.text,
        border: colors.line,
        notification: colors.brandRed,
      },
      fonts: {
        regular: { fontFamily: "Nunito_400Regular", fontWeight: "400" },
        medium: { fontFamily: "Nunito_600SemiBold", fontWeight: "600" },
        bold: { fontFamily: "Nunito_700Bold", fontWeight: "700" },
        heavy: { fontFamily: "Nunito_900Black", fontWeight: "900" },
      },
    }),
    [colors, name],
  );

  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          // Every screen paints its own background; an unpainted one underneath is what
          // shows through during a transition.
          contentStyle: { backgroundColor: colors.kidBgTop },
        }}
      >
        <Stack.Screen name="Home">
          {(props) => <HomeRoute {...props} library={library} />}
        </Stack.Screen>

        <Stack.Screen name="Search" options={{ animation: "slide_from_right" }}>
          {(props) => <SearchRoute {...props} library={library} />}
        </Stack.Screen>

        <Stack.Screen
          name="Settings"
          options={{ animation: "slide_from_right" }}
        >
          {({ navigation }) => (
            <SettingsScreen
              library={library}
              onBack={() => navigation.goBack()}
            />
          )}
        </Stack.Screen>

        <Stack.Screen
          name="Watch"
          options={{ presentation: "transparentModal", animation: "none" }}
        >
          {(props) => <WatchRoute {...props} library={library} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/**
 * The feed, and the query it is filtered by.
 *
 * The query is screen state rather than a route parameter: nobody should be able to link
 * to "home, with half a word typed in", and it should not survive a trip to settings.
 */
function HomeRoute({
  navigation,
  library,
}: NativeStackScreenProps<Routes, "Home"> & {
  library: LibraryController;
}) {
  const [query, setQuery] = useState("");
  const videos = useMemo(() => library.feed(query), [library, query]);

  const openVideo = useCallback(
    (video: Video) => navigation.navigate("Watch", { video }),
    [navigation],
  );

  const openSearch = useCallback(
    () => navigation.navigate("Search"),
    [navigation],
  );

  const openSettings = useCallback(
    () => navigation.navigate("Settings"),
    [navigation],
  );

  return (
    <HomeScreen
      videos={videos}
      query={query}
      onQueryChange={setQuery}
      onOpenVideo={openVideo}
      onOpenSearch={openSearch}
      onSettings={openSettings}
    />
  );
}

/**
 * The search screen, with a query of its own.
 *
 * Separate state rather than the home screen's, and deliberately so: the two are different
 * questions. Home's field narrows the feed you are looking at and should still be narrowed
 * when you come back from a video; this one is a search you went somewhere to do, and it
 * should be empty the next time you go there.
 */
function SearchRoute({
  navigation,
  library,
}: NativeStackScreenProps<Routes, "Search"> & {
  library: LibraryController;
}) {
  const [query, setQuery] = useState("");
  const videos = useMemo(() => library.feed(query), [library, query]);

  const openVideo = useCallback(
    (video: Video) => navigation.navigate("Watch", { video }),
    [navigation],
  );

  return (
    <SearchScreen
      videos={videos}
      query={query}
      onQueryChange={setQuery}
      onOpenVideo={openVideo}
      onBack={() => navigation.goBack()}
    />
  );
}

function WatchRoute({
  navigation,
  route,
  library,
}: NativeStackScreenProps<Routes, "Watch"> & {
  library: LibraryController;
}) {
  /**
   * A recommendation replaces this route's video rather than stacking a new route on top.
   * Pushing would leave a pile of players behind the visible one, each holding a live
   * WebView.
   */
  const selectVideo = useCallback(
    (next: Video) => navigation.setParams({ video: next }),
    [navigation],
  );

  const close = useCallback(() => navigation.goBack(), [navigation]);

  return (
    <WatchSheet
      video={route.params.video}
      approvedVideos={library.approvedVideos}
      onSelectVideo={selectVideo}
      onClose={close}
    />
  );
}
