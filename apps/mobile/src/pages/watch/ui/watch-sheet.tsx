import type { Video } from "@repo/catalog/types";
import { StatusBar } from "expo-status-bar";
import * as ScreenOrientation from "expo-screen-orientation";
import * as SystemUI from "expo-system-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import SystemVolume from "../../../../modules/system-volume";
import { recommendationsFor } from "../../../entities/library";
import { ChannelAvatar } from "../../../entities/video";
import { PlayerView, type PlayerHandle } from "../../../widgets/player";
import {
  RecommendationHeader,
  RecommendationList,
} from "../../../widgets/recommendations/ui/recommendation-panel";
import { STORAGE_KEYS } from "../../../shared/config/app-config";
import { useTheme } from "../../../shared/lib/theme/use-theme";
import { useVideoLabels } from "../../../shared/lib/format/use-video-labels";
import {
  readPreference,
  writePreference,
} from "../../../shared/lib/storage/preferences";
import { space, type } from "../../../shared/config/theme";

/** Past this much of a downward drag, letting go dismisses rather than springs back. */
const DISMISS_RATIO = 0.25;
/**
 * A fast enough flick dismisses without covering the distance. In pixels per millisecond,
 * which is what a `PanResponder` reports — not the pixels per second Gesture Handler uses.
 */
const DISMISS_VELOCITY = 1.1;
/**
 * A flick still has to travel this far to count.
 *
 * Without it a plain tap closes the sheet: a touch that goes down and up in a few
 * milliseconds with a pixel or two of jitter reports a velocity above any threshold, and
 * the velocity test alone believes it.
 */
const FLICK_DISTANCE = 40;
/** How far a finger travels before the sheet follows it rather than the list scrolling. */
const DRAG_SLOP = 10;
const DURATION = 260;

/**
 * The watch screen, as a sheet over the home screen.
 *
 * No header, no grabber, and no black band above the video: the picture starts at the top
 * of the screen with the status bar over it, which is what a phone player looks like.
 *
 * The way back is to drag down from anywhere — the video, the title, the channel, or the
 * recommendations while they are scrolled to the top. That last clause is the trick: the
 * drag only claims a touch when the list underneath has nothing left to scroll up, so one
 * gesture serves both without the two fighting.
 *
 * A `PanResponder` rather than a Gesture Handler pan, for one hard reason. The video is a
 * WebView, which takes touches in native code before Gesture Handler's per-view
 * recognisers see them — the same reason `usePlayerTaps` exists. React Native's responder
 * system runs from the root view, so it still gets them, and a drag that starts on the
 * video is exactly what has to work.
 *
 * Release is a decision between distance and velocity: a quarter of the screen, or a flick
 * fast enough to mean it. Distance alone makes a quick flick feel ignored; velocity alone
 * dismisses the slow careful drag of someone reconsidering.
 */
export function WatchSheet({
  video,
  approvedVideos,
  onSelectVideo,
  onClose,
}: {
  video: Video;
  approvedVideos: readonly Video[];
  onSelectVideo: (video: Video) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const labels = useVideoLabels();
  // The hook, not `Dimensions.get`: the dismiss threshold and the distance the sheet
  // travels off-screen both depend on it, and a rotation — which full screen causes — would
  // leave a one-time read stale.
  const { height } = useWindowDimensions();

  const player = useRef<PlayerHandle | null>(null);
  /**
   * Whether the list below has anything left to scroll up; see the drag rule above.
   *
   * State rather than a ref, because the responder is built in a `useMemo` and reading a
   * ref there is a render-time read of something that is not render output — which the
   * React Compiler flags, correctly. Only the crossing of zero changes it, so the
   * responder is rebuilt about as often as a finger reaches the top.
   */
  const [isListAtTop, setIsListAtTop] = useState(true);
  /**
   * Where the video ends on the screen, so a drag that starts on it can be told apart from
   * one that starts in the list below.
   */
  const [playerBottom, setPlayerBottom] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [areRecommendationsVisible, setAreRecommendationsVisible] =
    useState(true);

  const recommendations = useMemo(
    () => recommendationsFor(video, approvedVideos),
    [approvedVideos, video],
  );

  const currentIndex = approvedVideos.findIndex(
    (candidate) => candidate.id === video.id,
  );
  const previousVideo =
    currentIndex > 0 ? approvedVideos[currentIndex - 1] : null;
  /**
   * What "next" means, for the button and for the end card: the following approved video,
   * or the first recommendation when this one is the last in the library.
   */
  const nextVideo =
    currentIndex >= 0 && currentIndex < approvedVideos.length - 1
      ? approvedVideos[currentIndex + 1]
      : (recommendations[0] ?? null);

  const translateY = useSharedValue(height);

  useEffect(() => {
    translateY.value = withTiming(0, { duration: DURATION });
  }, [translateY]);

  /**
   * iOS only, and the other half of why a video used to arrive silent: the default audio
   * session is silenced by the ringer switch, whatever the player does about muting.
   */
  useEffect(() => {
    void SystemVolume.configureForPlayback();
  }, []);

  /**
   * Full screen is landscape, because a 16:9 video in portrait is a strip with most of the
   * screen wasted. The lock is put back on the way out and on unmount, so leaving the
   * sheet mid-video cannot leave the app stuck sideways.
   */
  useEffect(() => {
    if (!isFullscreen) {
      // Nothing to do on the way in: locking portrait here is a configuration change the
      // app does not need, and on Android it costs an activity restart — which took the
      // sheet down with it and looked like the video simply refusing to open.
      return;
    }

    /**
     * The window's own colour, under everything React Native draws.
     *
     * Rotating into full screen showed a flash of it, because `app.json` paints it the
     * app's cream and the rotation animation is the platform's — there is no React frame
     * to cover those milliseconds. Black for the duration of full screen makes the
     * rotation read as the picture turning rather than the app blinking.
     */
    void SystemUI.setBackgroundColorAsync("#000000");
    void ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE,
    );

    return () => {
      void SystemUI.setBackgroundColorAsync(null);
      // Released rather than locked back to portrait, so the device decides again.
      void ScreenOrientation.unlockAsync();
    };
  }, [isFullscreen]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const stored = await readPreference(STORAGE_KEYS.recommendations);
      if (!cancelled && stored !== null) {
        setAreRecommendationsVisible(stored === "1");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function changeRecommendationsVisibility(isVisible: boolean) {
    setAreRecommendationsVisible(isVisible);
    void writePreference(STORAGE_KEYS.recommendations, isVisible ? "1" : "0");
  }

  // Built once. The writes to `translateY.value` are the canonical Reanimated API from an
  // event callback; the React Compiler's `immutability` rule does not model shared values,
  // so it reads them as mutations of something captured. Silenced here and nowhere wider.
  /* eslint-disable react-hooks/immutability -- Reanimated shared-value writes. */
  const drag = useMemo(
    () =>
      PanResponder.create({
        // Never on touch-down: a tap has to reach the video's own handler, and a press has
        // to reach the row it landed on.
        onStartShouldSetPanResponderCapture: () => false,
        /**
         * Claimed in the capture phase, which is the only phase that works here: a
         * `ScrollView` that has already taken the responder refuses to hand it back, so
         * asking after the fact — `onMoveShouldSetPanResponder` — never wins and a drag
         * that starts over the list does nothing.
         *
         * The `y0` clause is what makes the gesture reliable. Gating the whole sheet on
         * "the list is scrolled to the top" meant that after scrolling the recommendations,
         * dragging the *video* down did nothing — the finger was nowhere near the list, but
         * the list's offset still vetoed it. A drag that starts on the player is always the
         * dismiss; only a drag that starts in the list has to wait for the list to run out
         * of scroll.
         */
        onMoveShouldSetPanResponderCapture: (event, gesture) => {
          const startedOnPlayer = gesture.y0 <= playerBottom;
          return (
            (startedOnPlayer || isListAtTop) &&
            gesture.dy > DRAG_SLOP &&
            Math.abs(gesture.dx) < Math.abs(gesture.dy)
          );
        },
        /**
         * Once claimed, kept. Both of these matter and neither is optional: the list asks
         * for the responder back the moment it sees a move, and on Android the native
         * scroll view will otherwise carry on scrolling underneath the drag — which showed
         * up as a sheet that took the gesture and then quietly sprang back.
         */
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderMove: (_event, gesture) => {
          // Clamped at 0: the sheet is already home, so an upward drag has nowhere to go.
          translateY.value = Math.max(0, gesture.dy);
        },
        onPanResponderRelease: (_event, gesture) => {
          const isDismissed =
            gesture.dy > height * DISMISS_RATIO ||
            (gesture.dy > FLICK_DISTANCE && gesture.vy > DISMISS_VELOCITY);

          if (isDismissed) {
            translateY.value = withTiming(height, { duration: DURATION });
            // Unmounted after the slide rather than from the animation's callback: closing
            // is a JS-side state change, and this keeps it off the UI thread.
            setTimeout(onClose, DURATION);
            return;
          }

          translateY.value = withTiming(0, { duration: DURATION });
        },
        onPanResponderTerminate: () => {
          translateY.value = withTiming(0, { duration: DURATION });
        },
      }),
    [height, isListAtTop, onClose, playerBottom, translateY],
  );
  /* eslint-enable react-hooks/immutability */

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[styles.sheet, animated, { backgroundColor: colors.surface }]}
      {...drag.panHandlers}
    >
      {/*
        The picture is edge to edge — full width in either orientation, nothing shaved off
        for the status bar — so the glyphs over it are light, and in full screen there are
        none. What keeps clear of the bar and the notch is the *controls*: see
        `controlInsets` in `PlayerView`.
      */}
      <StatusBar style="light" hidden={isFullscreen} />

      <PlayerView
        ref={player}
        onStageLayout={(bottom) => setPlayerBottom(bottom)}
        video={video}
        hasPrevious={previousVideo !== null}
        hasNext={nextVideo !== null}
        nextVideo={nextVideo}
        isFullscreen={isFullscreen}
        onToggleFullscreen={() => setIsFullscreen((current) => !current)}
        onPrevious={() => previousVideo && onSelectVideo(previousVideo)}
        onNext={() => nextVideo && onSelectVideo(nextVideo)}
      />

      {isFullscreen ? null : (
        /* The list, with the recommendations header pinned under the video by
           `stickyHeaderIndices` — the title and channel scroll away above it, which is the
           order of importance once something is playing.

           A touch here hides the controls and never shows them: only the player's own area
           is a switch. */
        <ScrollView
          style={styles.below}
          contentContainerStyle={[
            styles.belowContent,
            { paddingBottom: insets.bottom + space.gridGap * 2 },
          ]}
          stickyHeaderIndices={recommendations.length > 0 ? [1] : undefined}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(event) => {
            const isAtTop = event.nativeEvent.contentOffset.y <= 0;
            if (isAtTop !== isListAtTop) {
              setIsListAtTop(isAtTop);
            }
          }}
          onTouchStart={() => player.current?.hideControls()}
        >
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

          {recommendations.length > 0 ? (
            <RecommendationHeader
              isVisible={areRecommendationsVisible}
              onVisibilityChange={changeRecommendationsVisibility}
            />
          ) : null}

          {recommendations.length > 0 && areRecommendationsVisible ? (
            <RecommendationList
              videos={recommendations}
              onSelect={onSelectVideo}
            />
          ) : null}
        </ScrollView>
      )}
    </Animated.View>
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
  below: { flex: 1 },
  belowContent: { paddingTop: space.gridGap },
  meta: {
    gap: space.gridGap,
    paddingHorizontal: space.screenX,
    paddingBottom: space.gridGap,
  },
  /** `.watchTitle`, at the size a phone can give it. */
  title: { ...type.cardTitle, fontSize: 20, lineHeight: 25 },
  channelRow: { flexDirection: "row", alignItems: "center", gap: space.meta },
  channelText: { flex: 1, minWidth: 0 },
  channel: { ...type.cardTitle, fontSize: 15, lineHeight: 20, minHeight: 0 },
  views: type.muted,
});
