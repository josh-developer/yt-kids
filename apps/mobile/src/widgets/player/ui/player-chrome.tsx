import {
  Maximize2,
  Pause,
  Play,
  Repeat1,
  SkipBack,
  SkipForward,
  Volume2,
} from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslations } from "../../../shared/lib/i18n/use-translations";
import { fonts } from "../../../shared/config/theme";

/** `SEEK_STEP_SECONDS` in the web's `app-config.ts`. */
const SEEK_STEP = 15;

/**
 * The control layer over the video, as a picture.
 *
 * A deliberate copy of `player-controls.tsx` and `player-progress.tsx` from the
 * design side only — the pill bar, the transport buttons, the seek steps, the
 * gradient progress bar and the time readout, at the sizes and colours the web uses.
 * Nothing here is wired to playback: the props are display state, and the handlers
 * are optional. Playback belongs to the native player work, which is a separate job.
 *
 * Values that look arbitrary are lifted from `player.module.css`: a 28px round button
 * on `rgba(255,255,255,0.1)`, a white primary, the bar on `rgba(12,12,12,0.74)` at
 * 12px inset with a 999px radius, the progress bar 10px tall on
 * `rgba(255,255,255,0.24)` filled with the brand red-to-yellow gradient, and the time
 * pill at 11px/800 with a 78px floor so a timestamp changing width does not shuffle
 * the bar.
 *
 * The web blurs behind the bar and the time pill. That is dropped here for the same
 * reason it is dropped on the header: a backdrop blur over a video costs a
 * full-screen GPU pass per frame, and at this opacity the flat colour is
 * indistinguishable.
 */
export function PlayerChrome({
  isPlaying = false,
  isRepeatOne = false,
  positionLabel,
  progress,
  hasNext = false,
  hasPrevious = false,
}: {
  isPlaying?: boolean;
  isRepeatOne?: boolean;
  /** Already formatted, e.g. `0:04 / 1:16:02`, as `.playerTime` renders it. */
  positionLabel: string;
  /** 0 to 1. */
  progress: number;
  hasNext?: boolean;
  hasPrevious?: boolean;
}) {
  const t = useTranslations("Player");

  return (
    <>
      <View style={styles.progressWrap} pointerEvents="box-none">
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.max(0, Math.min(1, progress)) * 100}%` },
            ]}
          />
        </View>
        <View style={styles.timePill}>
          <Text style={styles.timeText}>{positionLabel}</Text>
        </View>
      </View>

      <View style={styles.bar} accessibilityLabel={t("controls")}>
        <ControlButton label={t("previousVideo")} isDisabled={!hasPrevious}>
          <SkipBack size={16} color="#ffffff" fill="#ffffff" />
        </ControlButton>
        <ControlButton label={t("nextVideo")} isDisabled={!hasNext}>
          <SkipForward size={16} color="#ffffff" fill="#ffffff" />
        </ControlButton>
        <View style={styles.divider} />

        <ControlButton label={t("back15")} isWide>
          <Text style={styles.seekStepText}>-{SEEK_STEP}</Text>
        </ControlButton>
        <ControlButton label={t("forward15")} isWide>
          <Text style={styles.seekStepText}>+{SEEK_STEP}</Text>
        </ControlButton>
        <View style={styles.divider} />

        <ControlButton label={isPlaying ? t("pause") : t("play")} isPrimary>
          {isPlaying ? (
            <Pause size={16} color="#0f0f0f" fill="#0f0f0f" />
          ) : (
            <Play size={16} color="#0f0f0f" fill="#0f0f0f" />
          )}
        </ControlButton>

        <ControlButton label={t("mute")}>
          <Volume2 size={16} color="#ffffff" />
        </ControlButton>

        {/* `.repeatButton { margin-left: auto }` pushes these to the far end. */}
        <View style={styles.spacer} />

        <ControlButton
          label={isRepeatOne ? t("repeatOneEnabled") : t("repeatOneDisabled")}
          isActive={isRepeatOne}
        >
          <Repeat1 size={16} color="#ffffff" />
        </ControlButton>
        <ControlButton label={t("fullScreen")}>
          <Maximize2 size={16} color="#ffffff" />
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
  isDisabled = false,
  isWide = false,
  onPress,
}: {
  label: string;
  children: React.ReactNode;
  isPrimary?: boolean;
  isActive?: boolean;
  isDisabled?: boolean;
  isWide?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled || !onPress}
      style={[
        styles.controlButton,
        isWide && styles.controlButtonWide,
        isPrimary && styles.controlButtonPrimary,
        isActive && styles.controlButtonActive,
        isDisabled && styles.controlButtonDisabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled, selected: isActive }}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // `.playerProgressWrap`: inset 12px, 54px from the bottom, above the bar.
  progressWrap: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 54,
    zIndex: 5,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  progressTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.24)",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    // `linear-gradient(90deg, var(--brand-red), var(--brand-yellow))`. A flat brand
    // red here: a gradient would need another `LinearGradient` mounted per frame of
    // playback, and the fill is 10px tall.
    backgroundColor: "#ff3157",
  },
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
  // `.safePlayerControls`.
  bar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    zIndex: 5,
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(12, 12, 12, 0.74)",
    shadowColor: "rgba(0, 0, 0, 0.24)",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 13,
    elevation: 6,
  },
  controlButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  // `.seekStep`: auto width, 14px radius, horizontal padding.
  controlButtonWide: {
    width: "auto",
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  controlButtonPrimary: { backgroundColor: "#ffffff" },
  controlButtonActive: { backgroundColor: "#1a73e8" },
  controlButtonDisabled: { opacity: 0.42 },
  seekStepText: {
    color: "#ffffff",
    fontSize: 12,
    fontFamily: fonts.black,
  },
  divider: {
    width: 1,
    height: 18,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  spacer: { flex: 1 },
});
