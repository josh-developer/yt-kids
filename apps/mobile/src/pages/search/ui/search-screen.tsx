import type { Video } from "@repo/catalog/types";
import { ArrowLeft } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { VideoGrid } from "../../../widgets/video-grid/ui/video-grid";
import { VideoSearchField } from "../../../features/video-search/ui/video-search-field";
import {
  IconButton,
  useIconColor,
  useIconSize,
} from "../../../shared/ui/icon-button";
import { FocusZone } from "../../../shared/ui/focus-zone";
import { useTheme } from "../../../shared/lib/theme/use-theme";
import { useTranslations } from "../../../shared/lib/i18n/use-translations";
import {
  useMetrics,
  useStyles,
  type Metrics,
} from "../../../shared/config/metrics";

/**
 * Search, as a screen of its own.
 *
 * It exists for the television. A text field on a TV means the system's on-screen
 * keyboard, and on Android TV that keyboard takes most of the picture — so filtering the
 * home grid live underneath it is filtering something the viewer cannot see. Giving search
 * its own screen means the results arrive where the keyboard has just left, and the field
 * can take focus on arrival, which is the one place in this app where doing so is what the
 * viewer asked for.
 *
 * A phone keeps its header field. Reaching this screen there would be a longer route to
 * the same thing.
 */
export function SearchScreen({
  videos,
  query,
  onQueryChange,
  onOpenVideo,
  onBack,
}: {
  /** Already filtered by `query`; the route owns the matching. */
  videos: readonly Video[];
  query: string;
  onQueryChange: (value: string) => void;
  onOpenVideo: (video: Video) => void;
  onBack: () => void;
}) {
  const { colors, name } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslations("TopBar");
  const iconColor = useIconColor();
  const iconSize = useIconSize();
  const m = useMetrics();
  const styles = useStyles(makeStyles);

  const hasQuery = query.trim().length > 0;

  return (
    <View style={styles.screen}>
      <StatusBar style={name === "dark" ? "light" : "dark"} />

      <LinearGradient
        colors={[colors.kidBgTop, colors.kidBgMid, colors.kidBgBottom]}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />

      <FocusZone
        style={{
          ...styles.header,
          paddingTop: insets.top + m.overscanY + m.space.meta,
        }}
      >
        <IconButton label={t("back")} onPress={onBack}>
          <ArrowLeft size={iconSize} color={iconColor} />
        </IconButton>

        <View style={styles.field}>
          <VideoSearchField
            query={query}
            onQueryChange={onQueryChange}
            // Filtering is live, so there is nothing to submit; the only thing left for
            // the return key to do is put the keyboard away, which the platform does.
            onSubmit={() => undefined}
            // The one place autofocus is right: arriving here *is* the request to type.
            autoFocus
          />
        </View>
      </FocusZone>

      {hasQuery && videos.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textSoft }]}>
          {t("noResults", { query })}
        </Text>
      ) : (
        <VideoGrid
          videos={videos}
          onOpenVideo={onOpenVideo}
          topInset={m.space.gridGap}
        />
      )}
    </View>
  );
}

const makeStyles = (m: Metrics) =>
  StyleSheet.create({
    screen: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: m.space.meta,
      paddingHorizontal: m.space.screenX,
      paddingBottom: m.space.gridGap,
    },
    /** Capped for the same reason the header's inline field is: width is not usefulness. */
    field: { flex: 1, maxWidth: 620 },
    empty: {
      ...m.type.muted,
      textAlign: "center",
      paddingHorizontal: m.space.screenX,
      paddingVertical: m.space.gridGap * 2,
    },
  });
