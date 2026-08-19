import type { Video } from "@repo/catalog/types";
import { Image } from "expo-image";
import { RotateCcw } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { thumbnailUrl } from "../../../shared/api/thumbnails";
import { useTranslations } from "../../../shared/lib/i18n/use-translations";
import { useVideoLabels } from "../../../shared/lib/format/use-video-labels";
import { fonts } from "../../../shared/config/theme";
import { useMetrics, useStyles, type Metrics } from "../../../shared/config/metrics";

/** `AUTOPLAY_COUNTDOWN_SECONDS` in the web's `app-config.ts`. */
const COUNTDOWN_SECONDS = 4;

/**
 * What a finished video offers: the next one, a countdown, and a way not to.
 *
 * A port of the web's `UpNextOverlay` — the card with its thumbnail and title, the ring
 * counting down, and the two buttons under it — at the web's sizes and colours. The
 * countdown is the reason it exists rather than autoplaying straight away: a child who
 * wants the same video again, or a different one, has four seconds to say so, and the
 * ring is what makes that legible without reading.
 *
 * The ring is drawn as a track with a rotating half-mask on the web (a conic gradient
 * there). Here it is a plain ring with the number in it and the seconds counting down —
 * a conic gradient would mean an SVG per frame for a four-second animation.
 */
export function UpNextCard({
  video,
  onPlayNext,
  onReplay,
}: {
  video: Video;
  onPlayNext: () => void;
  onReplay: () => void;
}) {
  const t = useTranslations("Player");
  const labels = useVideoLabels();
  const m = useMetrics();
  const styles = useStyles(makeStyles);
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) {
      onPlayNext();
      return;
    }

    const timer = setTimeout(() => setSecondsLeft((left) => left - 1), 1000);
    return () => clearTimeout(timer);
  }, [onPlayNext, secondsLeft]);

  return (
    <View
      style={styles.overlay}
      accessibilityRole="alert"
      accessibilityLabel={t("upNext")}
    >
      <Pressable
        onPress={onPlayNext}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${t("upNext")}: ${labels.title(video)}`}
      >
        <Image
          source={thumbnailUrl(video.videoId)}
          style={styles.thumb}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={video.id}
          accessible={false}
        />

        <View style={styles.text}>
          <Text style={styles.label}>{t("upNext")}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {labels.title(video)}
          </Text>
        </View>

        <View style={styles.ring}>
          <Text style={styles.ringText}>{secondsLeft}</Text>
        </View>
      </Pressable>

      <View style={styles.actions}>
        <Pressable
          onPress={onReplay}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <RotateCcw size={m.font(18)} color="#ffffff" />
          <Text style={styles.buttonText}>{t("replay")}</Text>
        </Pressable>

        <Pressable
          onPress={onPlayNext}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>{t("cancelAutoplay")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (m: Metrics) =>
  StyleSheet.create({
    // `.upNext`: over everything, on a near-black wash. No blur, as everywhere else here.
    overlay: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 8,
      elevation: 8,
      alignItems: "center",
      justifyContent: "center",
      gap: m.font(14),
      padding: m.font(20),
      backgroundColor: "rgba(6, 6, 8, 0.82)",
    },
    // `.upNextCard`.
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: m.font(14),
      width: "92%",
      maxWidth: m.font(520),
      padding: m.space.meta,
      borderRadius: m.radius.card,
      backgroundColor: "rgba(255, 255, 255, 0.1)",
    },
    cardPressed: { backgroundColor: "rgba(255, 255, 255, 0.18)" },
    thumb: {
      width: m.font(116),
      aspectRatio: 16 / 9,
      borderRadius: m.radius.thumbnail,
      backgroundColor: "#1c1c1c",
    },
    text: { flex: 1, minWidth: 0, gap: 4 },
    label: {
      color: "rgba(255, 255, 255, 0.66)",
      fontSize: m.font(11),
      fontFamily: fonts.extrabold,
      letterSpacing: 0.7,
      textTransform: "uppercase",
    },
    title: {
      color: "#ffffff",
      fontSize: m.font(15),
      lineHeight: m.font(19),
      fontFamily: fonts.extrabold,
    },
    // `.upNextRing`, as a ring rather than a conic sweep.
    ring: {
      width: m.font(52),
      height: m.font(52),
      borderRadius: 999,
      borderWidth: m.font(4),
      borderColor: "#ff3157",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(12, 12, 14, 0.92)",
    },
    ringText: { color: "#ffffff", fontSize: m.font(16), fontFamily: fonts.black },
    actions: { flexDirection: "row", flexWrap: "wrap", gap: m.space.meta },
    // `.upNextButton`.
    button: {
      flexDirection: "row",
      alignItems: "center",
      gap: m.font(7),
      minHeight: m.font(38),
      paddingHorizontal: m.font(16),
      borderRadius: 999,
      backgroundColor: "rgba(255, 255, 255, 0.14)",
    },
    pressed: { backgroundColor: "rgba(255, 255, 255, 0.24)" },
    buttonText: { color: "#ffffff", fontSize: m.font(14), fontFamily: fonts.extrabold },
  });
