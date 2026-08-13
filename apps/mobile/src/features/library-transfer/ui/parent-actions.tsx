import * as Clipboard from "expo-clipboard";
import {
  ClipboardPaste,
  Link2,
  RotateCcw,
  Settings2,
  Share2,
  X,
} from "lucide-react-native";
import type { ReactNode } from "react";
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
import { Toast, useToast } from "../../../shared/ui/toast";
import { useTheme } from "../../../shared/lib/theme/use-theme";
import { useTranslations } from "../../../shared/lib/i18n/use-translations";
import { fonts, radius, space, type } from "../../../shared/config/theme";

/** Which sheet is open, if any. */
type Task = "import" | "add" | "reset" | null;

/**
 * The parent's four actions, behind one button in the corner.
 *
 * The web puts export, import, add and reset in a row above the list, because a desktop
 * has the width for four buttons and a heading. A phone does not, and the list is what a
 * parent came to read — so the actions fold into a button at the bottom right and open to
 * the left, over the list rather than pushing it down.
 *
 * Export needs no sheet: it copies and says so. The other three ask for something, so each
 * opens a `BottomSheet` — one implementation, one drag to dismiss, no dialogs borrowed
 * from a desktop.
 */
export function ParentActions({ library }: { library: LibraryController }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslations("Settings");
  const toast = useToast();

  const [isOpen, setIsOpen] = useState(false);
  const [task, setTask] = useState<Task>(null);
  const [code, setCode] = useState("");
  const [url, setUrl] = useState("");

  const spin = useSharedValue(0);

  function toggle() {
    setIsOpen((open) => {
      spin.value = withTiming(open ? 0 : 1, { duration: 200 });
      return !open;
    });
  }

  function start(next: Exclude<Task, null>) {
    setIsOpen(false);
    spin.value = withTiming(0, { duration: 160 });
    setTask(next);
  }

  async function exportCode() {
    setIsOpen(false);
    spin.value = withTiming(0, { duration: 160 });

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

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 90}deg` }],
  }));

  return (
    <>
      <View
        style={[styles.dock, { bottom: insets.bottom + space.gridGap }]}
        pointerEvents="box-none"
      >
        {isOpen ? (
          <Animated.View
            style={styles.actions}
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(120)}
          >
            <Action label={t("exportParentSettings")} onPress={exportCode}>
              <Share2 size={18} color={colors.buttonInk} />
            </Action>
            <Action
              label={t("importParentSettings")}
              onPress={() => start("import")}
            >
              <ClipboardPaste size={18} color={colors.buttonInk} />
            </Action>
            <Action label={t("addVideoLink")} onPress={() => start("add")}>
              <Link2 size={18} color={colors.buttonInk} />
            </Action>
            <Action label={t("resetAllVideos")} onPress={() => start("reset")}>
              <RotateCcw size={18} color={colors.buttonInk} />
            </Action>
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

  return (
    <Pressable
      onPress={() => void onPress()}
      style={({ pressed }) => [
        styles.action,
        { backgroundColor: colors.surface, borderColor: colors.line },
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
  const background = isDestructive
    ? colors.brandRed
    : isPrimary
      ? colors.buttonActive
      : colors.buttonSoft;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.sheetButton,
        { backgroundColor: background },
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

const styles = StyleSheet.create({
  /** Bottom right, over the list. `box-none` so the list keeps the rest of the corner. */
  dock: {
    position: "absolute",
    right: space.screenX,
    zIndex: 100,
    elevation: 100,
    alignItems: "flex-end",
    gap: space.meta,
  },
  actions: { alignItems: "flex-end", gap: 8 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
    paddingHorizontal: 14,
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
    ...type.muted,
    fontFamily: type.cardTitle.fontFamily,
    fontSize: 13,
  },
  fab: {
    width: 56,
    height: 56,
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
    minHeight: 120,
    padding: 12,
    borderRadius: radius.card,
    borderWidth: 1,
    ...type.muted,
    fontFamily: fonts.regular,
  },
  urlInput: {
    height: 46,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    ...type.muted,
    fontFamily: fonts.regular,
    paddingVertical: 0,
  },
  confirm: type.muted,
  sheetRow: { flexDirection: "row", gap: 8 },
  sheetButton: {
    flex: 1,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  sheetButtonLabel: {
    ...type.cardTitle,
    fontSize: 14,
    lineHeight: 18,
    minHeight: 0,
  },
  pressed: { opacity: 0.82 },
});
