import type { Video } from "@repo/catalog/types";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { thumbnailUrl } from "../../../shared/api/thumbnails";
import { useStyles, type Metrics } from "../../../shared/config/metrics";
import { THUMBNAIL_PLACEHOLDER_GRADIENT } from "../../../shared/config/theme";

/**
 * The 16:9 thumbnail, its duration pill, and the gradient the web shows behind a
 * loading image so a card is never a grey hole.
 *
 * `expo-image` rather than React Native's `Image`: it caches to disk as well as
 * memory, which is the difference between a scroll back up the list being free
 * and being 367 network requests. `recyclingKey` is what stops a recycled row
 * showing the previous video's picture for a frame.
 */
export function VideoThumbnail({
  video,
  priority,
}: {
  video: Video;
  /** The first screen's images are worth fetching eagerly; the rest can wait. */
  priority?: boolean;
}) {
  const styles = useStyles(makeStyles);

  return (
    <View style={styles.frame}>
      <LinearGradient
        colors={[...THUMBNAIL_PLACEHOLDER_GRADIENT]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Image
        source={thumbnailUrl(video.videoId)}
        style={styles.image}
        contentFit="cover"
        // Disk keeps them across launches; the catalog is static, so a thumbnail
        // fetched once should never be fetched again.
        cachePolicy="memory-disk"
        recyclingKey={video.id}
        priority={priority ? "high" : "normal"}
        // Long enough to read as a fade-in, short enough not to feel laggy while
        // scrolling past.
        transition={180}
        accessible={false}
      />
      <View style={styles.durationPill}>
        <Text style={styles.durationText}>{video.duration}</Text>
      </View>
    </View>
  );
}

const makeStyles = (m: Metrics) =>
  StyleSheet.create({
    frame: {
      width: "100%",
      aspectRatio: 16 / 9,
      borderRadius: m.radius.thumbnail,
      overflow: "hidden",
      // `.thumbnail`'s `#dddddd` under the gradient.
      backgroundColor: "#dddddd",
    },
    image: { width: "100%", height: "100%" },
    durationPill: {
      position: "absolute",
      right: m.space.card,
      bottom: m.space.card,
      paddingHorizontal: m.font(6),
      paddingVertical: m.font(3),
      borderRadius: m.radius.duration,
      backgroundColor: "rgba(0, 0, 0, 0.82)",
    },
    durationText: { ...m.type.duration, color: "#ffffff" },
  });
