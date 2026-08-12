import type { Video } from "@repo/catalog/types";
import { StyleSheet, Text, View } from "react-native";
import { useVideoLabels } from "../../../shared/lib/format/use-video-labels";
import { radius, size, type } from "../../../shared/config/theme";

/**
 * The channel's initial on its accent colour, as on the web — the accent is
 * carried by the catalog data, so both clients colour the same channel the same.
 */
export function ChannelAvatar({ video }: { video: Video }) {
  const labels = useVideoLabels();

  return (
    <View style={[styles.avatar, { backgroundColor: video.accent }]}>
      <Text style={styles.initial}>{labels.initial(video)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    width: size.avatar,
    height: size.avatar,
    borderRadius: radius.avatar,
    alignItems: "center",
    justifyContent: "center",
  },
  initial: { ...type.avatar, color: "#ffffff" },
});
