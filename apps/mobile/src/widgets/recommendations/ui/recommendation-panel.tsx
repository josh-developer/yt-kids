import type { Video } from "@repo/catalog/types";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { VideoThumbnail } from "../../../entities/video";
import { useTheme } from "../../../shared/lib/theme/use-theme";
import { useTranslations } from "../../../shared/lib/i18n/use-translations";
import { useVideoLabels } from "../../../shared/lib/format/use-video-labels";
import { radius, space, type } from "../../../shared/config/theme";

/**
 * The bar that names the list and can put it away.
 *
 * Separate from the list because the watch sheet pins it: it is the sticky child of the
 * scroll view, so it stays under the video while the videos themselves scroll past. That
 * only works if it is its own child, which is why this is not one component with the rows.
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
 * full width; under a player, what matters is how many choices fit above the fold, which
 * is what the settings screen's row shape already answers.
 */
export function RecommendationList({
  videos,
  onSelect,
}: {
  videos: readonly Video[];
  onSelect: (video: Video) => void;
}) {
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

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.card, opacity: pressed ? 0.72 : 1 },
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
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: space.meta,
    paddingHorizontal: space.screenX,
    paddingVertical: space.meta,
  },
  list: { gap: space.meta, paddingHorizontal: space.screenX },
  title: { ...type.cardTitle, fontSize: 16, lineHeight: 21, minHeight: 0 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.meta,
    padding: space.card,
    borderRadius: radius.card,
  },
  /** The settings row's 132px: two lines of title still fit beside it. */
  rowThumb: { width: 132 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { ...type.cardTitle, fontSize: 14, lineHeight: 18, minHeight: 0 },
  rowChannel: { ...type.muted, fontSize: 12, lineHeight: 16 },
  rowViews: { ...type.muted, fontSize: 12, lineHeight: 16 },
});
