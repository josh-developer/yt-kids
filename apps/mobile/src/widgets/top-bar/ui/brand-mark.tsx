import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import { useStyles, type Metrics } from "../../../shared/config/metrics";
import { BRAND_LETTERS } from "../../../shared/config/theme";

const brandIcon = require("../../../../assets/brand-mark.png");

/**
 * The wordmark: the real mascot app icon, then "KidTube" with its per-letter colours.
 *
 * The letters and their colours come from the theme module rather than being
 * inlined, because on the web they are four separate spans with four literal
 * colours — a list is the honest translation of that, and it keeps the colours
 * next to the tokens they sit beside.
 *
 * The badge's `rotate(-2deg)` is copied from the web. It keeps the icon feeling
 * playful in the header rather than like a pasted launcher asset.
 */
export function BrandMark() {
  const styles = useStyles(makeStyles);

  return (
    <View style={styles.brand}>
      <Image
        source={brandIcon}
        style={styles.badge}
        contentFit="cover"
        accessible={false}
      />

      <View style={styles.wordmark} accessibilityLabel="KidTube">
        {BRAND_LETTERS.map((letter) => (
          <Text
            key={letter.text}
            style={[styles.letter, { color: letter.color }]}
          >
            {letter.text}
          </Text>
        ))}
      </View>
    </View>
  );
}

const makeStyles = (m: Metrics) =>
  StyleSheet.create({
    brand: { flexDirection: "row", alignItems: "center", gap: m.space.meta },
    badge: {
      width: m.size.brandMarkWidth,
      height: m.size.brandMarkWidth,
      borderRadius: m.radius.brandMark,
      transform: [{ translateY: -4 }, { rotate: "-2deg" }],
      shadowColor: "rgba(255, 49, 87, 0.24)",
      shadowOffset: { width: 0, height: 7 },
      shadowOpacity: 1,
      shadowRadius: 13,
      elevation: 4,
    },
    wordmark: { flexDirection: "row", alignItems: "baseline" },
    letter: m.type.brand,
  });
