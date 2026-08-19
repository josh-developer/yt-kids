import type { Video } from "@repo/catalog/types";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TopBar, useTopBarHeight } from "../../../widgets/top-bar/ui/top-bar";
import { VideoGrid } from "../../../widgets/video-grid/ui/video-grid";
import { useTheme } from "../../../shared/lib/theme/use-theme";
import { useMetrics } from "../../../shared/config/metrics";

/**
 * The home screen: the app's background wash, the floating header, and the list.
 *
 * `scrollY` is owned here because two things read it — the list drives it, and the
 * header hides and returns from it. Keeping it at the screen means neither has to
 * know about the other.
 *
 * The gradient is the web's `.appShell` background —
 * `linear-gradient(180deg, top 0%, mid 48%, bottom 100%)` — drawn once behind a
 * transparent list rather than per row. The web also lays two fixed SVG doodle
 * layers over it; those are deliberately still absent, because a full-screen
 * decorative layer under a scrolling list is a performance decision worth measuring
 * rather than assuming.
 */
export function HomeScreen({
  videos,
  query,
  onQueryChange,
  onOpenVideo,
  onOpenSearch,
  onSettings,
}: {
  videos: readonly Video[];
  query: string;
  onQueryChange: (value: string) => void;
  onOpenVideo: (video: Video) => void;
  /** Television only: the header's magnifier leads to a screen of its own. */
  onOpenSearch: () => void;
  onSettings: () => void;
}) {
  const { colors, name } = useTheme();
  const insets = useSafeAreaInsets();
  const { space, overscanY } = useMetrics();
  const barHeight = useTopBarHeight();
  const scrollY = useSharedValue(0);

  /**
   * What the header has to clear at the top of the screen.
   *
   * The platform's inset plus a television's overscan, which the platform does not report
   * because there is no notch to report — see `overscanY`. On a phone and a tablet the
   * second term is zero and this is the inset it always was.
   */
  const topInset = insets.top + overscanY;

  // Written here rather than in the list: the value is owned at this level, and a
  // child must not mutate a shared value it received as a prop.
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  return (
    <View style={styles.screen}>
      {/* Follows the palette rather than the OS, so a viewer who chose light in a dark
          system still gets dark glyphs. */}
      <StatusBar style={name === "dark" ? "light" : "dark"} />

      <LinearGradient
        colors={[colors.kidBgTop, colors.kidBgMid, colors.kidBgBottom]}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />

      <VideoGrid
        videos={videos}
        onOpenVideo={onOpenVideo}
        onScroll={onScroll}
        // The header's own height leaves the first card flush against its bottom
        // edge, touching the search field. One grid gap of clearance is the same
        // space the cards keep from each other.
        topInset={barHeight + topInset + space.gridGap}
      />

      {/* The status bar keeps a strip of the background under it once the header has
          hidden itself, so the clock and the battery stay legible over a thumbnail
          that would otherwise scroll behind them. `kidBgTop` is the gradient's first
          stop, so the strip is invisible while the header is up. */}
      <View
        style={[
          styles.statusStrip,
          { height: topInset, backgroundColor: colors.kidBgTop },
        ]}
        pointerEvents="none"
      />

      {/* After the list in the tree so it stacks above it, which also means the
          list's own elevation cannot paint over the header on Android. */}
      <TopBar
        scrollY={scrollY}
        topInset={topInset}
        query={query}
        onQueryChange={onQueryChange}
        onOpenSearch={onOpenSearch}
        onSettings={onSettings}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  statusStrip: { position: "absolute", top: 0, left: 0, right: 0 },
});
