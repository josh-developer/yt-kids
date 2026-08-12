import { Search, X } from "lucide-react-native";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useTheme } from "../../../shared/lib/theme/use-theme";
import { useTranslations } from "../../../shared/lib/i18n/use-translations";
import { fonts, radius, type } from "../../../shared/config/theme";

/**
 * The rounded field with a search button on its right, as on the web.
 *
 * The button submits there because a form needs submitting; here the query filters as
 * it is typed, so tapping it just dismisses the keyboard — the results are already
 * behind it. It is kept because the web has it and because it is the affordance that
 * says "this is a search box" before anyone has typed.
 *
 * The clear button is not on the web, where a keyboard always has Escape and a mouse
 * can select-all. On a phone, emptying a field character by character is the kind of
 * small misery worth one more control.
 */
export function VideoSearchField({
  query,
  onQueryChange,
  onSubmit,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const { colors } = useTheme();
  const t = useTranslations("TopBar");

  return (
    <View
      style={[
        styles.field,
        { backgroundColor: colors.surface, borderColor: colors.line },
      ]}
    >
      <Search size={18} color={colors.textSoft} />

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
        // The one field in a child's app, so it should never be focused by surprise.
        autoFocus={false}
      />

      {query.length > 0 ? (
        <Pressable
          onPress={() => onQueryChange("")}
          style={styles.clear}
          accessibilityRole="button"
          accessibilityLabel={t("search")}
          // A small glyph needs a bigger target than its own box.
          hitSlop={10}
        >
          <X size={16} color={colors.textSoft} />
        </Pressable>
      ) : null}

      <Pressable
        onPress={onSubmit}
        style={[styles.button, { backgroundColor: colors.buttonSoft }]}
        accessibilityRole="button"
        accessibilityLabel={t("search")}
      >
        <Search size={18} color={colors.buttonInk} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 16,
    paddingRight: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    // The placeholder must sit at the same size as the text that replaces it.
    ...type.muted,
    fontFamily: fonts.regular,
    // Android gives an input vertical padding of its own, which pushes the text off
    // centre inside a fixed-height pill.
    paddingVertical: 0,
  },
  clear: { padding: 4 },
  button: {
    width: 36,
    height: 36,
    borderRadius: radius.avatar,
    alignItems: "center",
    justifyContent: "center",
  },
});
