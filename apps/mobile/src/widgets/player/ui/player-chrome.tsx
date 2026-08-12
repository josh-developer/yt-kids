import { LinearGradient } from "expo-linear-gradient";
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Repeat1,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react-native";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { useTranslations } from "../../../shared/lib/i18n/use-translations";
import { useSystemVolume } from "../../../shared/lib/audio/use-system-volume";
import type { Player } from "../model/use-player";
import { fonts } from "../../../shared/config/theme";

/**
 * The progress bar and the control strip, as the web draws them at phone width.
 *
 * Every metric is `player.module.css`, taking the `@media (max-width: 720px)` branch
 * where there is one — which is why this strip holds so little. On the web,
 * `.footerTransportControls` (previous, next and the ±15 steps) is `display: none` under
 * 720px, because play, previous and next are on the picture and the seek steps are the
 * double tap. What is left is what a phone shows: play, mute, the volume stepper and its
 * meter, then repeat and full screen pushed to the end.
 *
 * The values, for anyone diffing this against the CSS: strip inset 8px with 4px/6px
 * padding, 5px gaps, 34px minimum height, `rgba(12,12,12,0.74)`; buttons 28px on
 * `rgba(255,255,255,0.1)`, the primary white with `#0f0f0f` glyphs, an engaged control
 * `#1a73e8`; repeat 32px; full screen `rgba(255,255,255,0.12)`; the meter 48x4px on
 * `rgba(255,255,255,0.22)` filled with `--brand-yellow`; the progress track 10px on
 * `rgba(255,255,255,0.24)` filled red-to-yellow; the time pill 78px wide at 11px/800.
 *
 * The web blurs behind the strip and the pill. Dropped here, as everywhere else in this
 * app: a backdrop blur over a playing video is a full-screen GPU pass per frame, and at
 * these opacities the flat colour is indistinguishable.
 */
export function PlayerChrome({
  player,
  insets,
  isFullscreen,
  onToggleFullscreen,
}: {
  player: Player;
  /** Safe-area padding to keep clear of; zero unless the video owns the whole screen. */
  insets: { top: number; bottom: number; left: number; right: number };
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const t = useTranslations("Player");
  const volume = useSystemVolume();
  const [trackWidth, setTrackWidth] = useState(0);

  const progress =
    player.duration > 0
      ? Math.min(1, Math.max(0, player.position / player.duration))
      : 0;
  const volumePercent = Math.round(volume.volume * 100);
  const isSilent = player.isMuted || volumePercent === 0;

  // Rebuilt when the width changes, since the seek fraction divides by it.
  const scrub = useMemo(
    () =>
      Gesture.Pan()
        .minDistance(0)
        .onBegin((event) => {
          if (trackWidth > 0) {
            scheduleOnRN(player.seekToFraction, event.x / trackWidth);
          }
        })
        .onEnd((event) => {
          if (trackWidth > 0) {
            scheduleOnRN(player.seekToFraction, event.x / trackWidth);
          }
        }),
    [player.seekToFraction, trackWidth],
  );

  return (
    <>
      {/* `.playerProgressWrap`: the bar and the time, inset 12px, clear of the strip. */}
      <View
        style={[
          styles.progressWrap,
          {
            bottom: 54 + insets.bottom,
            left: 12 + insets.left,
            right: 12 + insets.right,
          },
        ]}
        pointerEvents="box-none"
      >
        <GestureDetector gesture={scrub}>
          <View
            style={styles.progressTouch}
            onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
            accessibilityRole="adjustable"
            accessibilityLabel={t("seek")}
          >
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={["#ff3157", "#ffd84d"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${progress * 100}%` }]}
              />
            </View>
          </View>
        </GestureDetector>

        <View style={styles.timePill}>
          <Text style={styles.timeText}>
            {formatTime(player.position)} / {formatTime(player.duration)}
          </Text>
        </View>
      </View>

      <View
        style={[
          styles.bar,
          {
            bottom: 8 + insets.bottom,
            left: 8 + insets.left,
            right: 8 + insets.right,
          },
        ]}
        accessibilityLabel={t("controls")}
      >
        <ControlButton
          label={player.isPlaying ? t("pause") : t("play")}
          isPrimary
          onPress={player.togglePlayback}
        >
          {player.isPlaying ? (
            <Pause size={16} color="#0f0f0f" fill="#0f0f0f" />
          ) : (
            <Play size={16} color="#0f0f0f" fill="#0f0f0f" />
          )}
        </ControlButton>

        <ControlButton
          label={player.isMuted ? t("unmute") : t("mute")}
          onPress={player.toggleMute}
        >
          {isSilent ? (
            <VolumeX size={16} color="#ffffff" />
          ) : volumePercent < 50 ? (
            <Volume1 size={16} color="#ffffff" />
          ) : (
            <Volume2 size={16} color="#ffffff" />
          )}
        </ControlButton>

        <ControlButton label={t("volumeDown")} onPress={() => volume.nudge(-1)}>
          <Text style={styles.stepText}>−</Text>
        </ControlButton>

        {/* `.volumeMeter`: a meter, not a slider — the steps either side move it. */}
        <View
          style={styles.meter}
          accessibilityRole="progressbar"
          accessibilityLabel={t("volume", { value: volumePercent })}
          accessibilityValue={{ min: 0, max: 100, now: volumePercent }}
        >
          <View style={[styles.meterFill, { width: `${volumePercent}%` }]} />
        </View>

        <ControlButton label={t("volumeUp")} onPress={() => volume.nudge(1)}>
          <Text style={styles.stepText}>+</Text>
        </ControlButton>

        {/* `.repeatButton { margin-left: auto }` — these two sit at the end. */}
        <View style={styles.spacer} />

        <ControlButton
          label={
            player.isRepeatOne ? t("repeatOneEnabled") : t("repeatOneDisabled")
          }
          isActive={player.isRepeatOne}
          isLarge
          onPress={player.toggleRepeatOne}
        >
          <Repeat1 size={18} color="#ffffff" />
        </ControlButton>

        <ControlButton
          label={isFullscreen ? t("exitFullScreen") : t("fullScreen")}
          isFullscreenButton
          onPress={onToggleFullscreen}
        >
          {isFullscreen ? (
            <Minimize2 size={16} color="#ffffff" />
          ) : (
            <Maximize2 size={16} color="#ffffff" />
          )}
        </ControlButton>
      </View>
    </>
  );
}

function ControlButton({
  label,
  children,
  isPrimary = false,
  isActive = false,
  isLarge = false,
  isFullscreenButton = false,
  onPress,
}: {
  label: string;
  children: ReactNode;
  isPrimary?: boolean;
  isActive?: boolean;
  isLarge?: boolean;
  isFullscreenButton?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.controlButton,
        isLarge && styles.controlButtonLarge,
        isFullscreenButton && styles.controlButtonFullscreen,
        isPrimary && styles.controlButtonPrimary,
        isActive && styles.controlButtonActive,
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: isActive }}
    >
      {children}
    </Pressable>
  );
}

/** `formatTime` from the web's `shared/lib/time`: `h:mm:ss` only when there are hours. */
function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const whole = Math.floor(seconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const rest = whole % 60;
  const padded = String(rest).padStart(2, "0");

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${padded}`
    : `${minutes}:${padded}`;
}

const styles = StyleSheet.create({
  progressWrap: {
    position: "absolute",
    zIndex: 5,
    elevation: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  /** A 24px band around the 10px bar, so a thumb can find it. */
  progressTouch: { flex: 1, height: 24, justifyContent: "center" },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.24)",
  },
  progressFill: { height: "100%", borderRadius: 999 },
  timePill: {
    minWidth: 78,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(12, 12, 12, 0.72)",
  },
  timeText: {
    color: "#ffffff",
    fontSize: 11,
    fontFamily: fonts.extrabold,
    textAlign: "center",
  },
  // `.safePlayerControls`, phone branch.
  bar: {
    position: "absolute",
    zIndex: 5,
    elevation: 5,
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(12, 12, 12, 0.74)",
    shadowColor: "rgba(0, 0, 0, 0.24)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 13,
  },
  controlButton: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  controlButtonLarge: { width: 32, height: 32 },
  controlButtonFullscreen: { backgroundColor: "rgba(255, 255, 255, 0.12)" },
  controlButtonPrimary: { backgroundColor: "#ffffff" },
  controlButtonActive: { backgroundColor: "#1a73e8" },
  pressed: { opacity: 0.82 },
  /** `.volumeStep`: 17px, and the glyph is the whole button. */
  stepText: {
    color: "#ffffff",
    fontSize: 17,
    lineHeight: 20,
    fontFamily: fonts.black,
  },
  meter: {
    width: 48,
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.22)",
  },
  meterFill: { height: "100%", borderRadius: 999, backgroundColor: "#ffd84d" },
  spacer: { flex: 1 },
});
