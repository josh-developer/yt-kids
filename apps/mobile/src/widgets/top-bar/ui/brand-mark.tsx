import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import {
  BRAND_LETTERS,
  BRAND_MARK_GRADIENT,
  radius,
  size,
  type,
} from "../../../shared/config/theme";

/**
 * The wordmark: a play badge, then "KidTube" with its per-letter colours.
 *
 * The letters and their colours come from the theme module rather than being
 * inlined, because on the web they are four separate spans with four literal
 * colours — a list is the honest translation of that, and it keeps the colours
 * next to the tokens they sit beside.
 *
 * The badge's `rotate(-2deg)` is copied too. It is the detail that makes the mark
 * look drawn rather than placed, and dropping it would be the kind of quiet
 * divergence that adds up.
 */
export function BrandMark() {
  return (
    <View style={styles.brand}>
      <LinearGradient
        colors={[...BRAND_MARK_GRADIENT]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.badge}
      >
        <View style={styles.playGlyph} />
      </LinearGradient>

      <View style={styles.wordmark} accessibilityLabel="KidTube">
        {BRAND_LETTERS.map((letter) => (
          <Text key={letter.text} style={[styles.letter, { color: letter.color }]}>
            {letter.text}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: 10 },
  badge: {
    width: size.brandMarkWidth,
    height: size.brandMarkHeight,
    borderRadius: radius.brandMark,
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "-2deg" }],
    shadowColor: "rgba(255, 49, 87, 0.24)",
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 1,
    shadowRadius: 13,
    elevation: 4,
  },
  /**
   * A triangle from borders rather than an icon dependency. The web uses a
   * lucide `Play` at 18px filled; one shape is not worth pulling an icon set and
   * an SVG runtime into the bundle for.
   */
  playGlyph: {
    width: 0,
    height: 0,
    marginLeft: 3,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 12,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
    borderLeftColor: "#ffffff",
    borderRightWidth: 0,
  },
  wordmark: { flexDirection: "row", alignItems: "baseline" },
  letter: type.brand,
});
