import type { Video } from "@repo/catalog/types";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Lock, Unlock } from "lucide-react-native";
import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { PlayerChrome } from "./player-chrome";
import { PlayerTransport } from "./player-transport";
import { UpNextCard } from "./up-next-card";
import { buildPlayerHtml } from "../model/player-bridge";
import { usePlayer } from "../model/use-player";
import { usePlayerTaps } from "../model/use-player-taps";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SITE_URL } from "../../../config";
import { thumbnailUrl } from "../../../shared/api/thumbnails";
import { useTranslations } from "../../../shared/lib/i18n/use-translations";
import { type as textType } from "../../../shared/config/theme";

/** What the screen around the player may ask of it. */
export type PlayerHandle = {
  /** Used by a tap outside the video, which may hide the controls but never show them. */
  hideControls: () => void;
};

/**
 * The video and everything that belongs to it: the page it plays in, the controls over
 * it, and the taps that drive both.
 *
 * One component owns all three on purpose. The WebView needs a ref, the commands need
 * that ref, and a ref that crosses a component boundary is a ref read during someone
 * else's render — which the React Compiler flags, correctly, because the value it points
 * at is not part of anything's render output. Keeping it here means nothing has to be
 * silenced.
 *
 * `pointerEvents="none"` on the page is what makes the app's gestures possible: the embed
 * has no controls of its own, so there is nothing in it to touch, and letting it see
 * touches would mean every tap fought the tap handler above it.
 *
 * The props under `mediaPlaybackRequiresUserAction` are why a video starts with sound
 * here when the same embed cannot in a browser: an app that has asked for unattended
 * playback is trusted with it. With the playback audio session set on the iOS side, that
 * is both halves of why iOS used to arrive silent.
 *
 * Navigation away is refused. A child should not be one mis-tap from youtube.com, and the
 * page has no reason to leave: the initial document and the YouTube embed hosts are the
 * whole list.
 */
export const PlayerView = forwardRef<
  PlayerHandle,
  {
    video: Video;
    hasPrevious: boolean;
    hasNext: boolean;
    /** What the end card offers to play, which is the next video in the sheet's list. */
    nextVideo: Video | null;
    /** Owned by the sheet, which has to change its whole layout for it. */
    isFullscreen: boolean;
    onToggleFullscreen: () => void;
    onPrevious: () => void;
    onNext: () => void;
  }
>(function PlayerView(
  {
    video,
    hasPrevious,
    hasNext,
    nextVideo,
    isFullscreen,
    onToggleFullscreen,
    onPrevious,
    onNext,
  },
  ref,
) {
  const t = useTranslations("Player");
  const player = usePlayer({ videoId: video.videoId });
  const window = useWindowDimensions();

  const insets = useSafeAreaInsets();

  /**
   * Full screen takes the window, sized rather than flexed so it is right on the frame the
   * rotation lands on rather than a layout pass later.
   *
   * The player does not rotate itself. An earlier version did, for a phone the OS had left
   * upright, and the two rotations fought: the OS turned the window as well, and the result
   * was a picture on its side with the controls somewhere off the screen. Asking for
   * landscape and then drawing into whatever window arrives is the only version that holds
   * on both platforms.
   */
  const fullscreenStyle = useMemo(
    () =>
      isFullscreen ? { width: window.width, height: window.height } : null,
    [isFullscreen, window.height, window.width],
  );

  /**
   * The controls keep out of the notch, the corners and the home indicator, in both
   * orientations. On the web this is `env(safe-area-inset-*)` inside
   * `.safePlayerControls`, which is what the "safe" in that class name is about.
   */
  const controlInsets = useMemo(
    () =>
      isFullscreen
        ? {
            top: insets.top,
            bottom: insets.bottom,
            left: insets.left,
            right: insets.right,
          }
        : { top: 0, bottom: 0, left: 0, right: 0 },
    [isFullscreen, insets.bottom, insets.left, insets.right, insets.top],
  );
  // Which third of the video a double tap landed in is a fraction of this.
  const [stageWidth, setStageWidth] = useState(0);

  useImperativeHandle(ref, () => ({ hideControls: player.hideControls }), [
    player.hideControls,
  ]);

  /**
   * The page is rebuilt only if the muted fallback has to be used. Switching videos is a
   * command to a page that is already warm — `loadVideoById` — which is what makes
   * tapping a recommendation start playing rather than load an iframe API again.
   */
  const html = useMemo(
    () =>
      buildPlayerHtml({
        videoId: video.videoId,
        origin: SITE_URL,
        startsMuted: player.startsMuted,
      }),
    // The video id is the page's starting point only; later videos arrive as commands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [player.startsMuted],
  );

  const taps = usePlayerTaps({
    isLocked: player.isLocked,
    width: stageWidth,
    seekStep: player.seekStep,
    onSeekBy: player.seekBy,
    onToggleControls: player.toggleControls,
  });

  return (
    <View
      /* The base style is swapped rather than overridden: React Native skips `undefined`
         when it merges styles, so an `aspectRatio: undefined` in the full-screen style
         leaves the 16:9 ratio in place — which is what held full screen to 731dp of a
         914dp landscape screen, the video filling its height and nothing else. */
      style={[isFullscreen ? styles.stageBare : styles.stage, fullscreenStyle]}
      onLayout={(event) => setStageWidth(event.nativeEvent.layout.width)}
    >
      {/* Behind the video: the poster the card was showing, so the first frame is
            never a black rectangle. */}
      <Image
        source={thumbnailUrl(video.videoId, "poster")}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory-disk"
        recyclingKey={video.id}
        accessible={false}
      />

      <View style={styles.page} pointerEvents="none">
        <WebView
          ref={player.attachWebView}
          // On the WebView itself, not only on its wrapper. It is a native view, and on
          // Android a React parent saying `pointerEvents="none"` does not stop the
          // platform handing it the touch.
          pointerEvents="none"
          // The base URL is what gives the injected page an origin, and it has to be
          // the same one the embed is told about above.
          source={{ html, baseUrl: SITE_URL }}
          originWhitelist={["*"]}
          style={styles.web}
          containerStyle={styles.web}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsAirPlayForMediaPlayback
          allowsFullscreenVideo={false}
          setSupportMultipleWindows={false}
          scrollEnabled={false}
          bounces={false}
          overScrollMode="never"
          // Hardware layers keep video composition off the main thread on Android.
          androidLayerType="hardware"
          onMessage={(event) => player.handleMessage(event.nativeEvent.data)}
          onShouldStartLoadWithRequest={(request) =>
            isAllowedUrl(request.url) || request.navigationType === "other"
          }
        />
      </View>

      {/* The layer the taps land on, above the page and below the controls.
            A WebView is a native view and takes touches whatever its React parent says
            about `pointerEvents`, so the gesture cannot be attached to anything that
            contains it — it has to be over it. */}
      <View
        style={styles.touchLayer}
        collapsable={false}
        onTouchEnd={taps.onTouchEnd}
      />

      {/* `.youtubeTitleCover`: the gradient that hides the embed's own title bar, which
          links out of the app. It is also what covers the branding YouTube flashes over
          the picture after a programmatic play or seek. */}
      <LinearGradient
        colors={["rgba(0,0,0,0.92)", "rgba(0,0,0,0.72)", "rgba(0,0,0,0)"]}
        locations={[0, 0.44, 1]}
        style={[
          styles.titleCover,
          // `clamp(46px, 8vw, 68px)`: the embed's title bar grows with the width, and a
          // fixed 46px left it showing in landscape.
          { height: Math.min(68, Math.max(46, stageWidth * 0.08)) },
        ]}
        pointerEvents="none"
      />

      {/* The lock. Visible whether or not the controls are, because it is the way back
          out of a locked player. */}
      <Pressable
        onPress={player.toggleLock}
        style={({ pressed }) => [
          styles.lock,
          { top: 12 + controlInsets.top, left: 12 + controlInsets.left },
          pressed && styles.lockPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          player.isLocked ? t("unlockControls") : t("lockControls")
        }
        accessibilityState={{ selected: player.isLocked }}
      >
        {player.isLocked ? (
          <Lock size={24} color="#ffffff" />
        ) : (
          <Unlock size={24} color="#ffffff" />
        )}
      </Pressable>

      {player.areControlsVisible && !player.hasEnded && !player.isLocked ? (
        <>
          {/* `.playerBox::after` — the scrim the controls sit on, so they stay legible
              over a bright frame. */}
          <View style={styles.scrim} pointerEvents="none" />
          <PlayerTransport
            insets={controlInsets}
            player={player}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
            onPrevious={onPrevious}
            onNext={onNext}
          />
          <PlayerChrome
            player={player}
            insets={controlInsets}
            isFullscreen={isFullscreen}
            onToggleFullscreen={onToggleFullscreen}
          />
        </>
      ) : null}

      {/* A finished video hands the surface over: the card covers the embed's own replay
          button, which is the only way to be rid of it. */}
      {player.hasEnded && nextVideo ? (
        <UpNextCard
          video={nextVideo}
          onPlayNext={onNext}
          onReplay={player.replay}
        />
      ) : null}

      {player.status === "error" ? (
        <View style={styles.error} pointerEvents="none">
          <Text style={styles.errorTitle}>{t("blockedTitle")}</Text>
          <Text style={styles.errorBody}>{t("blockedBody")}</Text>
        </View>
      ) : null}
    </View>
  );
});

const ALLOWED_HOSTS = [
  "youtube.com",
  "youtube-nocookie.com",
  "ytimg.com",
  // The page's own base URL, so the document it starts from counts as allowed.
  SITE_URL.replace(/^https?:\/\//, ""),
];

function isAllowedUrl(url: string) {
  if (url === "about:blank" || url.startsWith("data:")) {
    return true;
  }

  const host = url.split("/")[2] ?? "";
  return ALLOWED_HOSTS.some(
    (allowed) => host === allowed || host.endsWith(`.${allowed}`),
  );
}

const styles = StyleSheet.create({
  /** `.playerBox`: 16:9 on `#080808`, full-bleed rather than 1120px-capped. */
  stage: {
    width: "100%",
    aspectRatio: 16 / 9,
    backgroundColor: "#080808",
    overflow: "hidden",
  },
  /** The same surface without the ratio, for full screen. */
  stageBare: { backgroundColor: "#080808", overflow: "hidden" },
  /** `.youtubeTitleCover`; the height comes from the stage's width. */
  titleCover: {
    position: "absolute",
    top: 0,
    right: 0,
    left: 0,
    zIndex: 3,
    elevation: 3,
  },
  // `.playerLockButton`: 42px at phone width, inset 12px, over everything.
  lock: {
    position: "absolute",
    zIndex: 7,
    elevation: 7,
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(12, 12, 12, 0.74)",
    shadowColor: "rgba(0, 0, 0, 0.24)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 13,
  },
  lockPressed: { opacity: 0.82 },
  web: { flex: 1, backgroundColor: "transparent" },
  /**
   * Android composites a hardware-layer WebView above later siblings unless they claim a
   * higher elevation, so the page names its own and everything over it names a higher one.
   * `zIndex` alone is enough on iOS and not enough here.
   */
  page: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
    elevation: 1,
  },
  touchLayer: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 2,
    elevation: 2,
  },
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "34%",
    zIndex: 3,
    elevation: 3,
    backgroundColor: "rgba(0, 0, 0, 0.42)",
  },
  error: {
    position: "absolute",
    left: 24,
    right: 24,
    top: "28%",
    gap: 6,
    zIndex: 4,
    elevation: 4,
  },
  errorTitle: {
    ...textType.cardTitle,
    color: "#ffffff",
    fontSize: 16,
    lineHeight: 21,
    minHeight: 0,
    textAlign: "center",
  },
  errorBody: {
    ...textType.muted,
    color: "rgba(255, 255, 255, 0.82)",
    textAlign: "center",
  },
});
