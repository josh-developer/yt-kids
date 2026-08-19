import type { Video } from "@repo/catalog/types";
import { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import { ChannelAvatar } from "./channel-avatar";
import { VideoThumbnail } from "./video-thumbnail";
import { useTheme } from "../../../shared/lib/theme/use-theme";
import { useVideoLabels } from "../../../shared/lib/format/use-video-labels";
import { useDevice } from "../../../shared/lib/device/use-device";
import { focusRing, useFocusable } from "../../../shared/ui/use-focusable";
import {
  useMetrics,
  useStyles,
  type Metrics,
} from "../../../shared/config/metrics";

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
 *
 * On a television the same animation runs the other way: the card the D-pad is on lifts
 * and takes a ring, which is the only thing telling a viewer across the room where they
 * are. The lift is larger than the press is deep for the same reason — it has further to
 * travel to be seen.
 */
export const VideoCard = memo(function VideoCard({
  video,
  priority,
  hasTVPreferredFocus = false,
  onOpen,
}: {
  video: Video;
  priority?: boolean;
  /** Where the D-pad lands when the grid first appears; the first card claims it. */
  hasTVPreferredFocus?: boolean;
  onOpen: (video: Video) => void;
}) {
  const { colors } = useTheme();
  const { isTV } = useDevice();
  const labels = useVideoLabels();
  const { size } = useMetrics();
  const styles = useStyles(makeStyles);
  const { handlers, style, isFocused } = useFocusable({
    pressDepth: 0.02,
    focusLift: 0.06,
  });

  return (
    <Animated.View style={style}>
      <Pressable
        onPress={() => onOpen(video)}
        {...handlers}
        hasTVPreferredFocus={hasTVPreferredFocus}
        style={[
          styles.card,
          { backgroundColor: colors.card, shadowColor: colors.shadow },
          focusRing(size.focusRing, colors.buttonActive, isFocused),
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${labels.title(video)}. ${labels.channel(video)}`}
      >
        <VideoThumbnail video={video} priority={priority} />

        <View style={styles.meta}>
          {/* No avatar on a television. Four columns across a 960dp panel leave a card
              192dp of content, and the avatar and its gap take 72 of them — which is what
              was ellipsising every channel name on the grid mid-word. A card there is the
              picture and its title, which is what every TV launcher shows anyway. */}
          {isTV ? null : <ChannelAvatar video={video} />}
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
