import type { Video } from "@repo/catalog/types";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { VideoThumbnail } from "../../../entities/video";
import { focusRing, useFocusable } from "../../../shared/ui/use-focusable";
import { useTheme } from "../../../shared/lib/theme/use-theme";
import { useTranslations } from "../../../shared/lib/i18n/use-translations";
import { useVideoLabels } from "../../../shared/lib/format/use-video-labels";
import {
  useMetrics,
  useStyles,
  type Metrics,
} from "../../../shared/config/metrics";

/**
 * The bar that names the list and can put it away.
 *
 * Separate from the list because the watch screen pins it: in one column it is the sticky
 * child of the scroll view, so it stays under the video while the videos themselves scroll
 * past, and in two columns it is the fixed head of the aside while the aside scrolls under
 * it. Both need it to be its own child, which is why this is not one component with the
 * rows.
 *
 * The switch is the point of it rather than decoration: a child who wants the video and
 * nothing else can put the list away, and it stays away — the choice is stored, so it
 * holds for the next video and the next launch.
 *
 * The background is opaque for the same pinning reason. A translucent header would show
 * the rows sliding underneath it.
 */
export function RecommendationHeader({
  isVisible,
  onVisibilityChange,
}: {
  isVisible: boolean;
  onVisibilityChange: (isVisible: boolean) => void;
}) {
  const { colors } = useTheme();
  const t = useTranslations("Watch");
  const styles = useStyles(makeStyles);

  return (
    <View style={[styles.header, { backgroundColor: colors.surface }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        {t("recommendationsTitle")}
      </Text>
      <Switch
        value={isVisible}
        onValueChange={onVisibilityChange}
        accessibilityLabel={t("showRecommendations")}
        trackColor={{ false: colors.buttonSoft, true: colors.buttonActive }}
        thumbColor="#ffffff"
      />
    </View>
  );
}

/**
 * What to watch next.
 *
 * Rows rather than cards. A card is the home screen's unit and gives a 16:9 thumbnail the
 * full width; under a player — or beside one — what matters is how many choices fit
 * without scrolling, which is what the settings screen's row shape already answers.
 */
export function RecommendationList({
  videos,
  onSelect,
}: {
  videos: readonly Video[];
  onSelect: (video: Video) => void;
}) {
  const styles = useStyles(makeStyles);

  return (
    <View style={styles.list}>
      {videos.map((video) => (
        <RecommendationRow
          key={video.id}
          video={video}
          onPress={() => onSelect(video)}
        />
      ))}
    </View>
  );
}

function RecommendationRow({
  video,
  onPress,
}: {
  video: Video;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const t = useTranslations("Watch");
  const labels = useVideoLabels();
  const { size } = useMetrics();
  const styles = useStyles(makeStyles);
  // Shallower than a button's: a row this wide magnifies a small scale into a large
  // amount of movement.
  const { handlers, style, isFocused } = useFocusable({
    pressDepth: 0.01,
    focusLift: 0.03,
  });

  return (
    <Animated.View style={style}>
      <Pressable
        onPress={onPress}
        {...handlers}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: colors.card, opacity: pressed ? 0.72 : 1 },
          focusRing(size.focusRing, colors.buttonActive, isFocused),
        ]}
        accessibilityRole="button"
        accessibilityLabel={t("recommendations")}
      >
        <View style={styles.rowThumb}>
          <VideoThumbnail video={video} />
        </View>

        <View style={styles.rowText}>
          <Text
            style={[styles.rowTitle, { color: colors.text }]}
            numberOfLines={2}
          >
            {labels.title(video)}
          </Text>
          <Text
            style={[styles.rowChannel, { color: colors.textSoft }]}
            numberOfLines={1}
          >
            {labels.channel(video)}
          </Text>
          <Text style={[styles.rowViews, { color: colors.textSoft }]}>
            {labels.views(video)}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const makeStyles = (m: Metrics) =>
  StyleSheet.create({
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: m.space.meta,
      paddingHorizontal: m.space.screenX,
      paddingVertical: m.space.meta,
    },
    list: { gap: m.space.meta, paddingHorizontal: m.space.screenX },
    title: {
      ...m.type.cardTitle,
      fontSize: m.font(16),
      lineHeight: m.font(21),
      minHeight: 0,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: m.space.meta,
      padding: m.space.card,
      borderRadius: m.radius.card,
    },
    /**
     * The settings row's 132px: two lines of title still fit beside it.
     *
     * A fraction of the column rather than the scale factor, because in two columns this
     * row lives in a fixed-width aside — a thumbnail scaled to the *device* would crowd out
     * the title it is meant to leave room for.
     */
    rowThumb: { width: m.font(132), maxWidth: "46%" },
    rowText: { flex: 1, minWidth: 0, gap: 2 },
    rowTitle: {
      ...m.type.cardTitle,
      fontSize: m.font(14),
      lineHeight: m.font(18),
      minHeight: 0,
    },
    rowChannel: { ...m.type.muted, fontSize: m.font(12), lineHeight: m.font(16) },
    rowViews: { ...m.type.muted, fontSize: m.font(12), lineHeight: m.font(16) },
  });
