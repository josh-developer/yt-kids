import { LinearGradient } from "expo-linear-gradient";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { focusRing, useFocusable } from "../../../shared/ui/use-focusable";
import { useTranslations } from "../../../shared/lib/i18n/use-translations";
import type { Player } from "../model/use-player";
import { useMetrics, useStyles, type Metrics } from "../../../shared/config/metrics";

/**
 * The controls that sit on the picture: play in the middle, previous and next at the
 * edges.
 *
 * The web's `BigPlayButton` and `SideNavButtons`, at the sizes a phone gets from their
 * `clamp()`s — 54px for the primary, 42px for the sides — with the same colours: the
 * primary is `linear-gradient(135deg, --brand-red, #ff7147)` on a 34px-blur shadow, and
 * the sides are `rgba(12,12,12,0.62)` at 92% opacity.
 *
 * The row is `box-none` between the buttons, so a tap in the gap still reaches the
 * surface and toggles the controls, exactly as clicking beside them does on the web.
 */
export function PlayerTransport({
  player,
  insets,
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
}: {
  player: Player;
  /** Safe-area padding to keep clear of; zero unless the video owns the whole screen. */
  insets: { left: number; right: number };
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("Player");
  const m = useMetrics();
  const styles = useStyles(makeStyles);
  const primary = useFocusable();

  return (
    <View
      style={[
        styles.layer,
        {
          paddingLeft: m.space.meta + insets.left,
          paddingRight: m.space.meta + insets.right,
        },
      ]}
      pointerEvents="box-none"
    >
      <SideButton
        label={t("previousVideo")}
        isDisabled={!hasPrevious}
        onPress={onPrevious}
      >
        <SkipBack size={m.font(24)} color="#ffffff" fill="#ffffff" />
      </SideButton>

      {/* `.bigPlayButton`: the one control that is not a flat surface. */}
      <Pressable
        onPress={player.togglePlayback}
        {...primary.handlers}
        style={({ pressed }) => [
          styles.primaryShadow,
          focusRing(m.size.focusRing, "#ffffff", primary.isFocused),
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={player.isPlaying ? t("pause") : t("play")}
      >
        <LinearGradient
          colors={["#ff3157", "#ff7147"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.primary}
        >
          {player.isPlaying ? (
            <Pause size={m.font(30)} color="#ffffff" fill="#ffffff" />
          ) : (
            <Play size={m.font(30)} color="#ffffff" fill="#ffffff" />
          )}
        </LinearGradient>
      </Pressable>

      <SideButton label={t("nextVideo")} isDisabled={!hasNext} onPress={onNext}>
        <SkipForward size={m.font(24)} color="#ffffff" fill="#ffffff" />
      </SideButton>
    </View>
  );
}

function SideButton({
  label,
  children,
  isDisabled,
  onPress,
}: {
  label: string;
  children: ReactNode;
  isDisabled: boolean;
  onPress: () => void;
}) {
  const { size } = useMetrics();
  const styles = useStyles(makeStyles);
  const { handlers, isFocused } = useFocusable();

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      {...handlers}
      style={({ pressed }) => [
        styles.side,
        isDisabled && styles.disabled,
        // White rather than the palette's focus colour: this button sits on the picture,
        // and no palette colour survives every frame a video can show.
        focusRing(size.focusRing, "#ffffff", isFocused),
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: isDisabled }}
    >
      {children}
    </Pressable>
  );
}



const makeStyles = (m: Metrics) =>
  StyleSheet.create({
    /**
     * `.sidePlayerButtons`: the full surface, buttons pushed to its edges.
     *
     * Below the control strip, not above it. The web can afford the big play button's
     * `z-index: 6` because it is a small centred button; here the layer covers the whole
     * picture, and on Android a higher elevation takes the touch even through
     * `pointerEvents="box-none"` — which swallowed every tap on the strip underneath.
     */
    layer: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: 4,
      elevation: 4,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    side: {
      // `.sidePlayerButton`'s `clamp()` on the web; the device's own scale here.
      width: m.font(42),
      height: m.font(42),
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(12, 12, 12, 0.62)",
      opacity: 0.92,
      // `box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28)`.
      shadowColor: "rgba(0, 0, 0, 0.28)",
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 1,
      shadowRadius: 14,
      elevation: 6,
    },
    /** The shadow lives on the pressable; the gradient cannot carry it and clip too. */
    primaryShadow: {
      borderRadius: 999,
      shadowColor: "rgba(0, 0, 0, 0.36)",
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 1,
      shadowRadius: 17,
      elevation: 8,
    },
    primary: {
      width: m.font(54),
      height: m.font(54),
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },
    disabled: { opacity: 0.42 },
    pressed: { opacity: 0.82 },
  });
