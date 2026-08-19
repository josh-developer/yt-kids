import { Search, X } from "lucide-react-native";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useTheme } from "../../../shared/lib/theme/use-theme";
import { useTranslations } from "../../../shared/lib/i18n/use-translations";
import { useMetrics, useStyles, type Metrics } from "../../../shared/config/metrics";

/**
 * The rounded field, with the magnifier on the left and nothing on the right until
 * there is something to clear.
 *
 * The web has a submit button because a form needs submitting. Here the query filters
 * as it is typed, so the button only ever dismissed the keyboard — a control that
 * looked like it did something and did not, taking up the corner where the clear
 * button belongs. The magnifier on the left is the affordance that says "search"; that
 * is enough.
 */
export function VideoSearchField({
  query,
  onQueryChange,
  onSubmit,
  autoFocus = false,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  /**
   * Off everywhere the field shares a screen with something else — it is the one field
   * in a child's app and should never take the keyboard by surprise. The search *screen*
   * is the exception: arriving there is the request.
   */
  autoFocus?: boolean;
}) {
  const { colors } = useTheme();
  const t = useTranslations("TopBar");
  const styles = useStyles(makeStyles);
  const m = useMetrics();

  return (
    <View
      style={[
        styles.field,
        { backgroundColor: colors.surface, borderColor: colors.line },
      ]}
    >
      <Search size={m.font(18)} color={colors.textSoft} />

      <TextInput
        style={[styles.input, { color: colors.text }]}
        value={query}
        onChangeText={onQueryChange}
        onSubmitEditing={onSubmit}
        placeholder={t("searchApprovedVideos")}
        placeholderTextColor={colors.textSoft}
        accessibilityLabel={t("searchApprovedVideos")}
        returnKeyType="search"
        autoCorrect={false}
        // A parent typing a search should not be fighting autocapitalisation on a
        // catalog of Uzbek and Russian titles.
        autoCapitalize="none"
        autoFocus={autoFocus}
      />

      {query.length > 0 ? (
        <Pressable
          onPress={() => onQueryChange("")}
          style={styles.clear}
          accessibilityRole="button"
          accessibilityLabel={t("clearSearch")}
          // A small glyph needs a bigger target than its own box.
          hitSlop={10}
        >
          <X size={m.font(16)} color={colors.textSoft} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** The field's own height, which the header has to add up to know how tall it is. */
export function useSearchFieldHeight() {
  return useMetrics().font(44);
}

const makeStyles = (m: Metrics) =>
  StyleSheet.create({
    field: {
      height: m.font(44),
      flexDirection: "row",
      alignItems: "center",
      gap: m.font(8),
      paddingLeft: m.font(16),
      paddingRight: m.font(12),
      borderRadius: 999,
      borderWidth: 1,
    },
    input: {
      flex: 1,
      // The placeholder must sit at the same size as the text that replaces it.
      ...m.type.muted,
      fontFamily: m.fonts.regular,
      // Android gives an input vertical padding of its own, which pushes the text off
      // centre inside a fixed-height pill.
      paddingVertical: 0,
    },
    clear: { padding: m.font(4) },
  });
