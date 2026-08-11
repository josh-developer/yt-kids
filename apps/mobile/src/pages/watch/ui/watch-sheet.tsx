import type { Video } from "@repo/catalog/types";
import { Image } from "expo-image";
import { useEffect, useMemo } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
// The successor to Reanimated's deprecated `runOnJS`, from the worklets runtime
// Reanimated 4 is built on and already depends on.
import { scheduleOnRN } from "react-native-worklets";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PlayerChrome } from "../../../widgets/player/ui/player-chrome";
import { ChannelAvatar } from "../../../entities/video";
import { thumbnailUrl } from "../../../shared/api/thumbnails";
import { useTheme } from "../../../shared/lib/theme/use-theme";
import { useVideoLabels } from "../../../shared/lib/format/use-video-labels";
import { space, type } from "../../../shared/config/theme";

/** Past this much of a downward drag, letting go dismisses rather than springs back. */
const DISMISS_RATIO = 0.25;
/** A fast enough flick dismisses regardless of how far it travelled. */
const DISMISS_VELOCITY = 900;
const DURATION = 260;

/**
 * The watch screen, as a sheet over the home screen.
 *
 * No header: the video is the screen, and the way back is to drag it down — the
 * gesture YouTube trained everyone on. The header would also be the wrong thing to
 * put above a 16:9 surface on a phone, where vertical space is the whole budget.
 *
 * The drag runs on the UI thread through Gesture Handler and Reanimated, so it tracks
 * the finger rather than following it. Release is a decision between distance and
 * velocity: a quarter of the screen, or a flick fast enough to mean it. Distance alone
 * makes a quick flick feel ignored; velocity alone dismisses a slow careful drag that
 * was being reconsidered.
 *
 * Only downward drags count, and the sheet never travels above its resting place, so
 * the gesture cannot fight a future scroll of the content below the player.
 *
 * The video area is a poster and the control chrome — a picture of the player, not a
 * player. Playback is the next piece of work and deliberately separate.
 */
export function WatchSheet({
  video,
  onClose,
}: {
  video: Video;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const labels = useVideoLabels();
  // The hook, not `Dimensions.get`: the dismiss threshold and the distance the sheet
  // travels off-screen both depend on it, and a rotation or an iPad split view would
  // leave a one-time read stale.
  const { height } = useWindowDimensions();

  const translateY = useSharedValue(height);

  useEffect(() => {
    translateY.value = withTiming(0, { duration: DURATION });
  }, [translateY]);

  // Built once: recreating it each render would rebuild the native gesture.
  //
  // The two writes below are the canonical Reanimated + Gesture Handler API —
  // `sharedValue.value = …` inside a gesture callback, which runs as a worklet on the
  // UI thread. The React Compiler's `immutability` rule does not model worklets, so it
  // reads them as mutations of a captured value; it allows the identical write from a
  // JSX event prop, which is how `icon-button.tsx` gets away with it. There is no
  // rule-satisfying way to express a pan gesture, so it is silenced here and nowhere
  // wider.
  /* eslint-disable react-hooks/immutability -- Reanimated worklet writes; see above. */
  const drag = useMemo(
    () =>
      Gesture.Pan()
        .onUpdate((event) => {
          // Clamped at 0: the sheet is already home, so an upward drag has nowhere to go.
          translateY.value = Math.max(0, event.translationY);
        })
        .onEnd((event) => {
          const isDismissed =
            event.translationY > height * DISMISS_RATIO ||
            event.velocityY > DISMISS_VELOCITY;

          if (isDismissed) {
            translateY.value = withTiming(
              height,
              { duration: DURATION },
              (finished) => {
                if (finished) {
                  scheduleOnRN(onClose);
                }
              },
            );
            return;
          }

          translateY.value = withTiming(0, { duration: DURATION });
        }),
    [height, onClose, translateY],
  );
  /* eslint-enable react-hooks/immutability */

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <GestureDetector gesture={drag}>
      <Animated.View
        style={[styles.sheet, animated, { backgroundColor: colors.surface }]}
      >
        {/* The player is full width, edge to edge, with only the status bar above it. */}
        <View style={{ height: insets.top, backgroundColor: "#080808" }} />

        <View style={styles.stage}>
          <Image
            source={thumbnailUrl(video.videoId, "poster")}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            cachePolicy="memory-disk"
            recyclingKey={video.id}
            accessible={false}
          />
          {/* `.playerBox::after` — the scrim the controls sit on so they stay legible
              over a bright frame. */}
          <View style={styles.scrim} pointerEvents="none" />

          <PlayerChrome
            positionLabel={`0:00 / ${video.duration}`}
            progress={0}
            hasNext
          />
        </View>

        {/* The grabber sits under the player, where a downward drag starts. */}
        <View style={styles.grabberRow}>
          <View style={[styles.grabber, { backgroundColor: colors.line }]} />
        </View>

        <View style={styles.meta}>
          <Text style={[styles.title, { color: colors.text }]}>
            {labels.title(video)}
          </Text>

          <View style={styles.channelRow}>
            <ChannelAvatar video={video} />
            <View style={styles.channelText}>
              <Text
                style={[styles.channel, { color: colors.text }]}
                numberOfLines={1}
              >
                {labels.channel(video)}
              </Text>
              <Text
                style={[styles.views, { color: colors.textSoft }]}
                numberOfLines={1}
              >
                {labels.views(video)}
              </Text>
            </View>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 9000,
  },
  /** `.playerBox`: 16:9 on `#080808`, but full-bleed here rather than 1120px-capped. */
  stage: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#080808",
    overflow: "hidden",
  },
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "34%",
    backgroundColor: "rgba(0, 0, 0, 0.42)",
  },
  grabberRow: { alignItems: "center", paddingVertical: 10 },
  grabber: { width: 44, height: 5, borderRadius: 999 },
  meta: { paddingHorizontal: space.screenX, gap: space.gridGap },
  /** `.watchTitle`: 28px, 900-ish weight, tight line height. */
  title: { ...type.cardTitle, fontSize: 20, lineHeight: 25 },
  channelRow: { flexDirection: "row", alignItems: "center", gap: space.meta },
  channelText: { flex: 1, minWidth: 0 },
  channel: { ...type.cardTitle, fontSize: 15, lineHeight: 20, minHeight: 0 },
  views: type.muted,
});
