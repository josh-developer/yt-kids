import type { Video } from "@repo/catalog/types";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TOP_BAR_HEIGHT, TopBar } from "../../../widgets/top-bar/ui/top-bar";
import { VideoGrid } from "../../../widgets/video-grid/ui/video-grid";
import { useTheme } from "../../../shared/lib/theme/use-theme";

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
  onOpenVideo,
  onSettings,
}: {
  videos: Video[];
  onOpenVideo: (video: Video) => void;
  onSettings: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollY = useSharedValue(0);

  // Written here rather than in the list: the value is owned at this level, and a
  // child must not mutate a shared value it received as a prop.
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[colors.kidBgTop, colors.kidBgMid, colors.kidBgBottom]}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />

      <VideoGrid
        videos={videos}
        onOpenVideo={onOpenVideo}
        scrollY={scrollY}
        onScroll={onScroll}
        topInset={TOP_BAR_HEIGHT + insets.top}
      />

      {/* After the list in the tree so it stacks above it, which also means the
          list's own elevation cannot paint over the header on Android. */}
      <TopBar
        scrollY={scrollY}
        topInset={insets.top}
        onSettings={onSettings}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
