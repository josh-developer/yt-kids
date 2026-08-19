import type { Video } from "@repo/catalog/types";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { ChannelAvatar } from "./channel-avatar";
import { VideoThumbnail } from "./video-thumbnail";
import { useTheme } from "../../../shared/lib/theme/use-theme";
import { useVideoLabels } from "../../../shared/lib/format/use-video-labels";
import { useStyles, type Metrics } from "../../../shared/config/metrics";

/**
 * One card: thumbnail, then the avatar and the title/channel/views triple.
 *
 * `memo` earns its place here. The list re-renders on every scroll frame that
 * changes its animated header, and a card's props are a stable video object plus a
 * stable callback, so without it every visible row re-renders 60 times a second.
 *
 * The press animation replaces the web's `:hover` — a phone has no hover, but the
 * card should still acknowledge a touch. It runs on the UI thread through
 * Reanimated, so it stays smooth while the list is settling.
 */
export const VideoCard = memo(function VideoCard({
  video,
  priority,
  onOpen,
}: {
  video: Video;
  priority?: boolean;
  onOpen: (video: Video) => void;
}) {
  const { colors } = useTheme();
  const labels = useVideoLabels();
  const styles = useStyles(makeStyles);
  const pressed = useSharedValue(0);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.02 }],
  }));

  return (
    <Animated.View style={animated}>
      <Pressable
        onPress={() => onOpen(video)}
        onPressIn={() => {
          pressed.value = withSpring(1, { damping: 20, stiffness: 400 });
        }}
        onPressOut={() => {
          pressed.value = withSpring(0, { damping: 20, stiffness: 300 });
        }}
        style={[
          styles.card,
          { backgroundColor: colors.card, shadowColor: colors.shadow },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${labels.title(video)}. ${labels.channel(video)}`}
      >
        <VideoThumbnail video={video} priority={priority} />

        <View style={styles.meta}>
          <ChannelAvatar video={video} />
          {/* `minWidth: 0` on the web; here `flex: 1` with `flexShrink` is what
              stops a long unbroken channel name widening the whole row. */}
          <View style={styles.summary}>
            <Text
              style={[styles.title, { color: colors.text }]}
              numberOfLines={2}
            >
              {labels.title(video)}
            </Text>
            <Text
              style={[styles.muted, { color: colors.textSoft }]}
              numberOfLines={1}
            >
              {labels.channel(video)}
            </Text>
            <Text
              style={[styles.muted, { color: colors.textSoft }]}
              numberOfLines={1}
            >
              {labels.views(video)}
            </Text>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
});

const makeStyles = (m: Metrics) =>
  StyleSheet.create({
    card: {
      padding: m.space.card,
      borderRadius: m.radius.card,
      // `0 12px 26px rgba(49, 71, 93, 0.09)` translated: iOS takes the offset and
      // radius directly, Android only understands `elevation`.
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 1,
      shadowRadius: 13,
      elevation: 3,
    },
    meta: {
      flexDirection: "row",
      gap: m.space.meta,
      paddingTop: m.space.meta,
    },
    summary: { flex: 1, minWidth: 0 },
    // `min-height: 40px` on the web reserves two lines so cards line up whether a
    // title wraps or not.
    title: { ...m.type.cardTitle, minHeight: m.type.cardTitle.lineHeight * 2 },
    muted: m.type.muted,
  });
