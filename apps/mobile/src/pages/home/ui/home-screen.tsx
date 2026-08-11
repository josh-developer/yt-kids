import type { Video } from "@repo/catalog/types";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TopBar } from "../../../widgets/top-bar/ui/top-bar";
import { VideoGrid } from "../../../widgets/video-grid/ui/video-grid";
import { useTheme } from "../../../shared/lib/theme/use-theme";

/**
 * The home screen: the app's background wash, the header, and the list.
 *
 * The gradient is the web's `.appShell` background —
 * `linear-gradient(180deg, top 0%, mid 48%, bottom 100%)` — rendered once behind
 * a transparent list rather than per row. The web also lays two fixed SVG layers
 * of doodles over it; those are deliberately not here yet, since a full-screen
 * decorative layer under a scrolling list is a real performance decision on a
 * phone and worth measuring rather than assuming.
 */
export function HomeScreen({
  videos,
  onOpenVideo,
}: {
  videos: Video[];
  onOpenVideo: (video: Video) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <LinearGradient
        colors={[colors.kidBgTop, colors.kidBgMid, colors.kidBgBottom]}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={{ paddingTop: insets.top }}>
        <VideoGrid
          videos={videos}
          onOpenVideo={onOpenVideo}
          header={<TopBar />}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
});
