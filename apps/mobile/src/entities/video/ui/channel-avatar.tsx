import type { Video } from "@repo/catalog/types";
import { StyleSheet, Text, View } from "react-native";
import { useVideoLabels } from "../../../shared/lib/format/use-video-labels";
import { useStyles, type Metrics } from "../../../shared/config/metrics";

/**
 * The channel's initial on its accent colour, as on the web — the accent is
 * carried by the catalog data, so both clients colour the same channel the same.
 */
export function ChannelAvatar({ video }: { video: Video }) {
  const labels = useVideoLabels();
  const styles = useStyles(makeStyles);

  return (
    <View style={[styles.avatar, { backgroundColor: video.accent }]}>
      <Text style={styles.initial}>{labels.initial(video)}</Text>
    </View>
  );
}

const makeStyles = (m: Metrics) =>
  StyleSheet.create({
    avatar: {
      width: m.size.avatar,
      height: m.size.avatar,
      borderRadius: m.radius.avatar,
      alignItems: "center",
      justifyContent: "center",
    },
    initial: { ...m.type.avatar, color: "#ffffff" },
  });
