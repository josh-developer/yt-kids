import * as Clipboard from "expo-clipboard";
import {
  ClipboardPaste,
  Link2,
  RotateCcw,
  Settings2,
  Share2,
  X,
} from "lucide-react-native";
import type { ComponentType, ReactNode } from "react";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { LibraryController } from "../../../entities/library";
import {
  createCustomVideo,
  decodeLibrary,
  encodeLibrary,
  extractYouTubeId,
  TransferError,
} from "../model/transfer-codec";
import { BottomSheet } from "../../../shared/ui/bottom-sheet";
import {
  IconButton,
  useIconColor,
  useIconSize,
} from "../../../shared/ui/icon-button";
import { Toast, useToast } from "../../../shared/ui/toast";
import { useTheme } from "../../../shared/lib/theme/use-theme";
import { useTranslations } from "../../../shared/lib/i18n/use-translations";
import { focusRing, useFocusable } from "../../../shared/ui/use-focusable";
import {
  useMetrics,
  useStyles,
  type Metrics,
} from "../../../shared/config/metrics";

/** Which sheet is open, if any. */
type Task = "import" | "add" | "reset" | null;

/** One of the four, as the caller needs to draw it. */
export type ParentAction = {
  key: string;
  label: string;
  Icon: ComponentType<{ size: number; color: string }>;
  onPress: () => void;
};

/**
 * The parent's four actions — export, import, add and reset — and the sheets they open.
 *
 * A hook rather than a component because the trigger and the overlay have to live in
 * different places in the tree. A `BottomSheet` positions itself absolutely against its
 * parent, so it has to be mounted at the screen's root; the buttons that open it want to
 * be wherever that screen puts them, which on a tablet is the header. Returning the two
 * separately is what lets the caller decide, and keeps one copy of the state behind both.
 *
 * Export needs no sheet: it copies and says so. The other three ask for something.
 */
export function useParentActions(library: LibraryController) {
  const { colors } = useTheme();
  const t = useTranslations("Settings");
  const toast = useToast();
  const styles = useStyles(makeStyles);

  const [task, setTask] = useState<Task>(null);
  const [code, setCode] = useState("");
  const [url, setUrl] = useState("");

  function start(next: Exclude<Task, null>) {
    setTask(next);
  }

  async function exportCode() {
    try {
      await Clipboard.setStringAsync(encodeLibrary(library.snapshot()));
      toast.show(t("exportCopied"), "ok");
    } catch {
      toast.show(t("copyFailed"), "bad");
    }
  }

  function importCode() {
    const trimmed = code.trim();
    if (!trimmed) {
      toast.show(t("clipboardEmpty"), "bad");
      return;
    }

    try {
      const imported = decodeLibrary(trimmed);
      library.replaceLibrary({
        selectedIds: imported.selectedIds,
        customVideos: imported.customVideos,
      });
      setCode("");
      setTask(null);
      toast.show(
        t("libraryImported", {
          count: imported.selectedIds.length,
          value: String(imported.selectedIds.length),
        }),
        "ok",
      );
    } catch (error) {
      // Every failure reads the same to a parent: this is not a code from this app. The
      // one worth telling apart is a code from a version that knows more than this one.
      toast.show(
        error instanceof TransferError && error.reason === "unsupportedVersion"
          ? t("codeFromNewerVersion")
          : t("invalidCode"),
        "bad",
      );
    }
  }

  function addVideo() {
    const videoId = extractYouTubeId(url);
    if (!videoId) {
      toast.show(t("invalidUrl"), "bad");
      return;
    }

    const { wasAlreadyThere } = library.addVideo(createCustomVideo(videoId));
    setUrl("");
    setTask(null);
    toast.show(t(wasAlreadyThere ? "videoAlreadyAdded" : "videoAdded"), "ok");
  }

  function reset() {
    library.resetLibrary();
    setTask(null);
    toast.show(t("resetDone"), "ok");
  }

  const actions: ParentAction[] = [
    {
      key: "export",
      label: t("exportParentSettings"),
      Icon: Share2,
      onPress: () => void exportCode(),
    },
    {
      key: "import",
      label: t("importParentSettings"),
      Icon: ClipboardPaste,
      onPress: () => start("import"),
    },
    {
      key: "add",
      label: t("addVideoLink"),
      Icon: Link2,
      onPress: () => start("add"),
    },
    {
      key: "reset",
      label: t("resetAllVideos"),
      Icon: RotateCcw,
      onPress: () => start("reset"),
    },
  ];

  const overlay = (
    <>
      {task === "import" ? (
        <BottomSheet title={t("importSettings")} onClose={() => setTask(null)}>
          <TextInput
            style={[
              styles.codeInput,
              {
                color: colors.text,
                backgroundColor: colors.card,
                borderColor: colors.line,
              },
            ]}
            value={code}
            onChangeText={setCode}
            placeholder={t("pasteExportCode")}
            placeholderTextColor={colors.textSoft}
            accessibilityLabel={t("pasteExportCode")}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            textAlignVertical="top"
          />

          <View style={styles.sheetRow}>
            <SheetButton
              label={t("importSettings")}
              isPrimary
              onPress={importCode}
            />
            <SheetButton label={t("cancel")} onPress={() => setTask(null)} />
          </View>
        </BottomSheet>
      ) : null}

      {task === "add" ? (
        <BottomSheet title={t("addVideoLink")} onClose={() => setTask(null)}>
          <TextInput
            style={[
              styles.urlInput,
              {
                color: colors.text,
                backgroundColor: colors.card,
                borderColor: colors.line,
              },
            ]}
            value={url}
            onChangeText={setUrl}
            onSubmitEditing={addVideo}
            placeholder={t("pasteYoutubeLink")}
            placeholderTextColor={colors.textSoft}
            accessibilityLabel={t("pasteYoutubeLink")}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            keyboardType="url"
            returnKeyType="done"
          />

          <View style={styles.sheetRow}>
            <SheetButton label={t("addVideo")} isPrimary onPress={addVideo} />
            <SheetButton label={t("cancel")} onPress={() => setTask(null)} />
          </View>
        </BottomSheet>
      ) : null}

      {task === "reset" ? (
        <BottomSheet title={t("resetAllVideos")} onClose={() => setTask(null)}>
          <Text style={[styles.confirm, { color: colors.textSoft }]}>
            {t("resetAllVideosConfirm")}
          </Text>

          <View style={styles.sheetRow}>
            <SheetButton
              label={t("resetAllVideos")}
              isDestructive
              onPress={reset}
            />
            <SheetButton label={t("cancel")} onPress={() => setTask(null)} />
          </View>
        </BottomSheet>
      ) : null}

      <Toast state={toast.state} />
    </>
  );

  return { actions, overlay };
}

/**
 * The four actions as a row of icons, for a header that has room for them.
 *
 * The web puts export, import, add and reset in a row above the list, because a desktop
 * has the width for four buttons. A tablet does too — so they sit beside the screen's
 * title rather than folding into a corner, and the corner stops being somewhere a parent
 * has to reach at all.
 *
 * Icons only. A label on each would be four words competing with the screen's own title
 * for the same line; the label survives as the accessibility name, which is the reader
 * that actually needs it.
 */
export function ParentActionsBar({ actions }: { actions: ParentAction[] }) {
  const styles = useStyles(makeStyles);
  const color = useIconColor();
  const size = useIconSize();

  return (
    <View style={styles.bar}>
      {actions.map(({ key, label, Icon, onPress }) => (
        <IconButton key={key} label={label} onPress={onPress}>
          <Icon size={size} color={color} />
        </IconButton>
      ))}
    </View>
  );
}

/**
 * The four actions behind one button in the corner, for a screen with no room for a row.
 *
 * A phone's list is what a parent came to read, so the actions fold into a button at the
 * bottom right — where a thumb is — and open upwards over the list rather than pushing it
 * down.
 */
export function ParentActionsDock({ actions }: { actions: ParentAction[] }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslations("Settings");
  const m = useMetrics();
  const styles = useStyles(makeStyles);
  const [isOpen, setIsOpen] = useState(false);
  const spin = useSharedValue(0);

  function toggle() {
    setIsOpen((open) => {
      spin.value = withTiming(open ? 0 : 1, { duration: 200 });
      return !open;
    });
  }

  /** Every action closes the menu on its way out; none of them leaves it standing. */
  function run(action: ParentAction) {
    setIsOpen(false);
    spin.value = withTiming(0, { duration: 160 });
    action.onPress();
  }

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 90}deg` }],
  }));

  return (
    <View
      style={[styles.dock, { bottom: insets.bottom + m.space.gridGap }]}
      pointerEvents="box-none"
    >
      {isOpen ? (
        <Animated.View
          style={styles.actions}
          entering={FadeIn.duration(160)}
          exiting={FadeOut.duration(120)}
        >
          {actions.map((action) => (
            <Action
              key={action.key}
              label={action.label}
              onPress={() => run(action)}
            >
              <action.Icon size={m.font(18)} color={colors.buttonInk} />
            </Action>
          ))}
        </Animated.View>
      ) : null}

      <Pressable
        onPress={toggle}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.buttonActive },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t("parentActions")}
        accessibilityState={{ expanded: isOpen }}
      >
        <Animated.View style={spinStyle}>
          {isOpen ? (
            <X size={22} color="#ffffff" />
          ) : (
            <Settings2 size={22} color="#ffffff" />
          )}
        </Animated.View>
      </Pressable>
    </View>
  );
}

/** One of the four, as a pill that reads left of the button that opened it. */
function Action({
  label,
  children,
  onPress,
}: {
  label: string;
  children: ReactNode;
  onPress: () => void | Promise<void>;
}) {
  const { colors } = useTheme();
  const { size } = useMetrics();
  const styles = useStyles(makeStyles);
  const { handlers, isFocused } = useFocusable();

  return (
    <Pressable
      onPress={() => void onPress()}
      {...handlers}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: colors.surface,
          borderColor: isFocused ? colors.buttonInk : colors.line,
          borderWidth: isFocused ? size.focusRing : StyleSheet.hairlineWidth,
        },
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
    >
      {children}
      <Text
        style={[styles.actionLabel, { color: colors.text }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SheetButton({
  label,
  isPrimary = false,
  isDestructive = false,
  onPress,
}: {
  label: string;
  isPrimary?: boolean;
  isDestructive?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const { size } = useMetrics();
  const styles = useStyles(makeStyles);
  const { handlers, isFocused } = useFocusable();
  const background = isDestructive
    ? colors.brandRed
    : isPrimary
      ? colors.buttonActive
      : colors.buttonSoft;

  return (
    <Pressable
      onPress={onPress}
      {...handlers}
      style={({ pressed }) => [
        styles.sheetButton,
        { backgroundColor: background },
        focusRing(size.focusRing, colors.text, isFocused),
        pressed && styles.pressed,
      ]}
      accessibilityRole="button"
    >
      <Text
        style={[
          styles.sheetButtonLabel,
          { color: isPrimary || isDestructive ? "#ffffff" : colors.buttonInk },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const makeStyles = (m: Metrics) =>
  StyleSheet.create({
    /** Bottom right, over the list. `box-none` so the list keeps the rest of the corner. */
    dock: {
      position: "absolute",
      right: m.space.screenX,
      zIndex: 100,
      elevation: 100,
      alignItems: "flex-end",
      gap: m.space.meta,
    },
    actions: { alignItems: "flex-end", gap: m.font(8) },
    /** The header row's version: icons in a line, at the header's own rhythm. */
    bar: { flexDirection: "row", alignItems: "center", gap: m.space.meta },
    action: {
      flexDirection: "row",
      alignItems: "center",
      gap: m.font(8),
      height: m.font(40),
      paddingHorizontal: m.font(14),
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      // The pills sit over the list, so they need to lift off it.
      shadowColor: "rgba(20, 24, 33, 0.16)",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 1,
      shadowRadius: 10,
      elevation: 6,
    },
    actionLabel: {
      ...m.type.muted,
      fontFamily: m.type.cardTitle.fontFamily,
      fontSize: m.font(13),
    },
    fab: {
      width: m.font(56),
      height: m.font(56),
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: "rgba(20, 24, 33, 0.28)",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 1,
      shadowRadius: 14,
      elevation: 10,
    },
    codeInput: {
      minHeight: m.font(120),
      padding: m.font(12),
      borderRadius: m.radius.card,
      borderWidth: 1,
      ...m.type.muted,
      fontFamily: m.fonts.regular,
    },
    urlInput: {
      height: m.font(46),
      paddingHorizontal: m.font(14),
      borderRadius: 999,
      borderWidth: 1,
      ...m.type.muted,
      fontFamily: m.fonts.regular,
      paddingVertical: 0,
    },
    confirm: m.type.muted,
    sheetRow: { flexDirection: "row", gap: m.font(8) },
    sheetButton: {
      flex: 1,
      height: m.font(44),
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: m.font(12),
      borderRadius: 999,
    },
    sheetButtonLabel: {
      ...m.type.cardTitle,
      fontSize: m.font(14),
      lineHeight: m.font(18),
      minHeight: 0,
    },
    pressed: { opacity: 0.82 },
  });
