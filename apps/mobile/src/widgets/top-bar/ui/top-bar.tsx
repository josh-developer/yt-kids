import { StyleSheet, Text, View } from "react-native";
import { BrandMark } from "./brand-mark";
import { useTheme } from "../../../shared/lib/theme/use-theme";
import { size, space, type } from "../../../shared/config/theme";

/**
 * The header: wordmark on the left, search affordance below it.
 *
 * Scrolls away with the list rather than sticking. The web's top bar hides itself
 * as you scroll (`useTopbarAutoHide`) for the same reason — a small screen showing
 * videos should spend its height on videos — and letting it be the list's header is
 * the simplest way to get that without a second scroll listener fighting the first.
 *
 * The search field is presentational for now. It is here because the web's home
 * screen has it and leaving a hole would misrepresent the layout; wiring it up
 * needs the query filtering from `video-library.ts`, which is its own piece.
 */
export function TopBar() {
  const { colors } = useTheme();

  return (
    <View style={styles.bar}>
      <View style={styles.row}>
        <BrandMark />
      </View>

      <View
        style={[
          styles.search,
          { backgroundColor: colors.surface, borderColor: colors.line },
        ]}
      >
        <Text style={[styles.searchLabel, { color: colors.textSoft }]}>
          Tanlangan videolarni qidirish
        </Text>
      </View>
    </View>
  );
}

const SEARCH_HEIGHT = 44;

/**
 * The header's total height, exported because the grid needs it.
 *
 * The reveal animation works out where a card sits from its index, and every card
 * is pushed down by this header — so without it the arithmetic is off by exactly
 * this much and cards animate at the wrong moment. Derived from the same constants
 * the styles use rather than measured, so it cannot drift from them.
 */
export const TOP_BAR_HEIGHT =
  size.topBarHeight + space.meta + SEARCH_HEIGHT + space.gridGap;

const styles = StyleSheet.create({
  bar: { paddingBottom: space.gridGap, gap: space.meta },
  row: {
    height: size.topBarHeight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  search: {
    height: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  searchLabel: type.muted,
});
