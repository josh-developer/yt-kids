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
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PlayerProgress } from "./player-progress";
import { focusRing, useFocusable } from "../../../shared/ui/use-focusable";
import { useDevice } from "../../../shared/lib/device/use-device";
import { useTranslations } from "../../../shared/lib/i18n/use-translations";
import { useSystemVolume } from "../../../shared/lib/audio/use-system-volume";
import type { Player } from "../model/use-player";
import { fonts } from "../../../shared/config/theme";
import { useMetrics, useStyles, type Metrics } from "../../../shared/config/metrics";

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
  const { isTV } = useDevice();
  const m = useMetrics();
  const styles = useStyles(makeStyles);

  const volumePercent = Math.round(volume.volume * 100);
  const isSilent = player.isMuted || volumePercent === 0;

  return (
    <>
      <PlayerProgress
        position={player.position}
        duration={player.duration}
        insetBottom={insets.bottom}
        insetLeft={insets.left}
        insetRight={insets.right}
        onSeekToFraction={player.seekToFraction}
      />

      <View
        style={[
          styles.bar,
          {
            bottom: m.font(8) + insets.bottom,
            left: m.font(8) + insets.left,
            right: m.font(8) + insets.right,
          },
        ]}
        accessibilityLabel={t("controls")}
      >
        <ControlButton
          label={player.isPlaying ? t("pause") : t("play")}
          isPrimary
          hasTVPreferredFocus
          onPress={player.togglePlayback}
        >
          {player.isPlaying ? (
            <Pause size={m.font(16)} color="#0f0f0f" fill="#0f0f0f" />
          ) : (
            <Play size={m.font(16)} color="#0f0f0f" fill="#0f0f0f" />
          )}
        </ControlButton>

        {/* Volume is the television's, not the app's. A set has its own scale, its own
            remote keys and usually an amplifier past that, and a second scale inside the
            app is a second thing to be at the wrong level. Four controls of the strip go
            with it, which is also what leaves the remaining ones a comfortable D-pad
            distance apart. */}
        {isTV ? null : (
          <>
            <ControlButton
              label={player.isMuted ? t("unmute") : t("mute")}
              onPress={player.toggleMute}
            >
              {isSilent ? (
                <VolumeX size={m.font(16)} color="#ffffff" />
              ) : volumePercent < 50 ? (
                <Volume1 size={m.font(16)} color="#ffffff" />
              ) : (
                <Volume2 size={m.font(16)} color="#ffffff" />
              )}
            </ControlButton>

            <ControlButton
              label={t("volumeDown")}
              onPress={() => volume.nudge(-1)}
            >
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

            <ControlButton
              label={t("volumeUp")}
              onPress={() => volume.nudge(1)}
            >
              <Text style={styles.stepText}>+</Text>
            </ControlButton>
          </>
        )}

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
          <Repeat1 size={m.font(18)} color="#ffffff" />
        </ControlButton>

        {/* A television is already the full screen; a button that promises to make it
            one has nothing to do. */}
        {isTV ? null : (
          <ControlButton
            label={isFullscreen ? t("exitFullScreen") : t("fullScreen")}
            isFullscreenButton
            onPress={onToggleFullscreen}
          >
            {isFullscreen ? (
              <Minimize2 size={m.font(16)} color="#ffffff" />
            ) : (
              <Maximize2 size={m.font(16)} color="#ffffff" />
            )}
          </ControlButton>
        )}
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
  hasTVPreferredFocus = false,
  onPress,
}: {
  label: string;
  children: ReactNode;
  isPrimary?: boolean;
  isActive?: boolean;
  isLarge?: boolean;
  isFullscreenButton?: boolean;
  /** Play claims it, so the controls open with the D-pad on the thing most likely wanted. */
  hasTVPreferredFocus?: boolean;
  onPress: () => void;
}) {
  const { size } = useMetrics();
  const styles = useStyles(makeStyles);
  const { handlers, isFocused } = useFocusable();

  return (
    <Pressable
      onPress={onPress}
      {...handlers}
      hasTVPreferredFocus={hasTVPreferredFocus}
      style={({ pressed }) => [
        styles.controlButton,
        isLarge && styles.controlButtonLarge,
        isFullscreenButton && styles.controlButtonFullscreen,
        isPrimary && styles.controlButtonPrimary,
        isActive && styles.controlButtonActive,
        // White, because the strip is a dark surface over a picture and the palette's
        // focus colour would disappear into whichever frame is behind it.
        focusRing(size.focusRing, "#ffffff", isFocused),
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

const makeStyles = (m: Metrics) =>
  StyleSheet.create({
    /** A 24px band around the 10px bar, so a thumb can find it. */
    // `.safePlayerControls`, phone branch.
    bar: {
      position: "absolute",
      zIndex: 5,
      elevation: 5,
      minHeight: m.font(34),
      flexDirection: "row",
      alignItems: "center",
      gap: m.font(5),
      paddingHorizontal: m.font(6),
      paddingVertical: m.font(4),
      borderRadius: 999,
      backgroundColor: "rgba(12, 12, 12, 0.74)",
      shadowColor: "rgba(0, 0, 0, 0.24)",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 1,
      shadowRadius: 13,
    },
    controlButton: {
      width: m.font(28),
      height: m.font(28),
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255, 255, 255, 0.1)",
    },
    controlButtonLarge: { width: m.font(32), height: m.font(32) },
    controlButtonFullscreen: { backgroundColor: "rgba(255, 255, 255, 0.12)" },
    controlButtonPrimary: { backgroundColor: "#ffffff" },
    controlButtonActive: { backgroundColor: "#1a73e8" },
    pressed: { opacity: 0.82 },
    /** `.volumeStep`: 17px, and the glyph is the whole button. */
    stepText: {
      color: "#ffffff",
      fontSize: m.font(17),
      lineHeight: m.font(20),
      fontFamily: fonts.black,
    },
    meter: {
      width: m.font(48),
      height: m.font(4),
      borderRadius: 999,
      overflow: "hidden",
      backgroundColor: "rgba(255, 255, 255, 0.22)",
    },
    meterFill: { height: "100%", borderRadius: 999, backgroundColor: "#ffd84d" },
    spacer: { flex: 1 },
  });
