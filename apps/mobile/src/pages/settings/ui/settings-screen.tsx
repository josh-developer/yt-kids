import type { Video } from "@repo/catalog/types";
import { ArrowLeft, Eye, EyeOff } from "lucide-react-native";
import { useMemo, useState } from "react";
import { FlashList } from "@shopify/flash-list";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { LibraryController } from "../../../entities/library";
import { VideoThumbnail } from "../../../entities/video";
import {
  ParentActionsBar,
  ParentActionsDock,
  useParentActions,
} from "../../../features/library-transfer/ui/parent-actions";
import { VideoSearchField } from "../../../features/video-search/ui/video-search-field";
import {
  IconButton,
  useIconColor,
  useIconSize,
} from "../../../shared/ui/icon-button";
import { focusRing, useFocusable } from "../../../shared/ui/use-focusable";
import { useTheme } from "../../../shared/lib/theme/use-theme";
import { useDevice } from "../../../shared/lib/device/use-device";
import { useTranslations } from "../../../shared/lib/i18n/use-translations";
import { useVideoLabels } from "../../../shared/lib/format/use-video-labels";
import { matchesQuery } from "../../../shared/lib/format/matches-query";
import { useMetrics, useStyles, type Metrics } from "../../../shared/config/metrics";

type Tab = "approved" | "hidden";

/**
 * The parent screen: which videos a child may see.
 *
 * The web's `SettingsPanel` does more — add a video by URL, export and import the
 * library as a transfer code, approve or hide everything at once, reset to defaults —
 * and all of it needs parts of the library model that are not ported yet. What is here
 * is the part the home screen depends on: find a video, and move it in or out of the
 * approved set.
 *
 * A full screen rather than the web's panel-inside-the-shell, because a phone has no
 * room for a screen beside another one.
 *
 * On a wide window the rows go two across instead. The row shape is already short and
 * wide — a 132pt thumbnail and two lines of text — so a tablet running it in one column
 * spends half the screen on margin and shows a parent half as many videos while they hunt
 * for one. The header stays a single column: a search field and two tabs do not get better
 * for being 1000pt wide.
 */
export function SettingsScreen({
  library,
  onBack,
}: {
  library: LibraryController;
  onBack: () => void;
}) {
  const { colors, name } = useTheme();
  const { isWide, kind } = useDevice();
  const insets = useSafeAreaInsets();
  const t = useTranslations("Settings");
  const iconColor = useIconColor();
  const iconSize = useIconSize();
  const m = useMetrics();
  const styles = useStyles(makeStyles);
  const [tab, setTab] = useState<Tab>("approved");
  const [query, setQuery] = useState("");

  const columns = isWide ? 2 : 1;
  /**
   * Where the parent's four actions go. A phone folds them into a corner because its list
   * is the whole screen; anything larger has room for them beside the title, which is also
   * where the web puts them.
   */
  const isWideHeader = kind !== "phone";
  const parentActions = useParentActions(library);

  const results = useMemo(() => {
    const pool =
      tab === "approved" ? library.approvedVideos : library.hiddenVideos;
    return pool.filter((video) => matchesQuery(video, query));
  }, [library.approvedVideos, library.hiddenVideos, query, tab]);

  const search = (
    <VideoSearchField
      query={query}
      onQueryChange={setQuery}
      onSubmit={() => undefined}
    />
  );

  const tabs = (
    <>
      <TabButton
        label={t("approvedTab")}
        count={library.approvedVideos.length}
        isActive={tab === "approved"}
        isWide={isWideHeader}
        onPress={() => setTab("approved")}
      />
      <TabButton
        label={t("hiddenTab")}
        count={library.hiddenVideos.length}
        isActive={tab === "hidden"}
        isWide={isWideHeader}
        onPress={() => setTab("hidden")}
      />
    </>
  );

  return (
    <View style={styles.screen}>
      <StatusBar style={name === "dark" ? "light" : "dark"} />

      <LinearGradient
        colors={[colors.kidBgTop, colors.kidBgMid, colors.kidBgBottom]}
        locations={[0, 0.48, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View
        style={[
          styles.header,
          // The platform's inset plus a television's overscan, which it does not report.
          { paddingTop: insets.top + m.overscanY + m.space.meta },
        ]}
      >
        <View style={styles.headerRow}>
          <IconButton label={t("close")} onPress={onBack}>
            <ArrowLeft size={iconSize} color={iconColor} />
          </IconButton>

          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>
              {t("title")}
            </Text>
            <Text style={[styles.count, { color: colors.textSoft }]}>
              {t("approvedCount", {
                count: library.approvedCount,
                value: String(library.approvedCount),
              })}
            </Text>
          </View>

          {/* The field rides the title's line where there is room for it, which is the
              one place on this screen that has spare width — the title is two short lines
              and everything else is a list. */}
          {isWideHeader ? (
            <View style={styles.headerSearch}>{search}</View>
          ) : null}
        </View>

        {isWideHeader ? (
          /* Tabs left, actions right. Two clusters that never grow into each other, so
             the row costs one line instead of the two a stacked header needed. */
          <View style={styles.controlsRow}>
            <View style={styles.tabs}>{tabs}</View>
            <ParentActionsBar actions={parentActions.actions} />
          </View>
        ) : (
          <View style={styles.headerControls}>
            {search}
            <View style={styles.tabs}>{tabs}</View>
          </View>
        )}
      </View>

      {/* `FlashList`, for the same reason as the home grid: this is 400-odd rows and a
          parent scrolls it looking for one video. Recycled views keep a frame rate that
          mounting and unmounting rows cannot. */}
      <FlashList
        // Column count cannot change on a mounted list, so a rotation remounts it.
        key={`columns-${columns}`}
        data={results}
        numColumns={columns}
        keyExtractor={(video) => video.id}
        contentContainerStyle={{
          paddingHorizontal: m.space.screenX,
          paddingBottom: m.space.gridGap * 2 + insets.bottom + m.overscanY,
        }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textSoft }]}>
            {t("noVideosFound", { tab })}
          </Text>
        }
        renderItem={({ item, index }) => (
          // The gutter between columns lives on the cell rather than as a container `gap`:
          // a recycling list lays each row out on its own, so a `gap` has nothing to apply
          // to. Only the left-hand cell of a pair carries it.
          <View
            style={
              columns > 1 && index % columns === 0
                ? { paddingRight: m.space.meta / 2 }
                : columns > 1
                  ? { paddingLeft: m.space.meta / 2 }
                  : undefined
            }
          >
            <SettingsRow
              video={item}
              isApproved={tab === "approved"}
              onApprove={() => library.approve(item.id)}
              onHide={() => library.hide(item.id)}
            />
          </View>
        )}
      />

      {/* The corner button, only where the header could not take the row. */}
      {isWideHeader ? null : (
        <ParentActionsDock actions={parentActions.actions} />
      )}

      {/* The sheets and the toast, at the screen's root so they can position against it. */}
      {parentActions.overlay}
    </View>
  );
}

function TabButton({
  label,
  count,
  isActive,
  isWide,
  onPress,
}: {
  label: string;
  count: number;
  isActive: boolean;
  /** Sharing a row with the actions, so it sizes to its label instead of splitting a line. */
  isWide: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const { size } = useMetrics();
  const styles = useStyles(makeStyles);
  const { handlers, isFocused } = useFocusable();

  return (
    <Pressable
      onPress={onPress}
      {...handlers}
      style={[
        styles.tab,
        isWide && styles.tabWide,
        {
          backgroundColor: isActive ? colors.buttonActive : colors.buttonSoft,
        },
        focusRing(size.focusRing, colors.buttonInk, isFocused),
      ]}
      accessibilityRole="tab"
      accessibilityState={{ selected: isActive }}
    >
      <Text
        style={[
          styles.tabLabel,
          { color: isActive ? "#ffffff" : colors.buttonInk },
        ]}
        numberOfLines={1}
      >
        {label} · {count}
      </Text>
    </Pressable>
  );
}

/** A row in the curation list: the video, and the one action that applies to it. */
function SettingsRow({
  video,
  isApproved,
  onApprove,
  onHide,
}: {
  video: Video;
  isApproved: boolean;
  onApprove: () => void;
  onHide: () => void;
}) {
  const { colors } = useTheme();
  const t = useTranslations("Settings");
  const labels = useVideoLabels();
  const m = useMetrics();
  const styles = useStyles(makeStyles);
  const { handlers, isFocused } = useFocusable();

  return (
    <View style={[styles.row, { backgroundColor: colors.card }]}>
      <View style={styles.rowThumb}>
        <VideoThumbnail video={video} />
      </View>

      <View style={styles.rowText}>
        <Text
          style={[styles.rowTitle, { color: colors.text }]}
          numberOfLines={2}
        >
          {labels.title(video)}
        </Text>
        <Text
          style={[styles.rowChannel, { color: colors.textSoft }]}
          numberOfLines={1}
        >
          {labels.channel(video)}
        </Text>
      </View>

      <Pressable
        onPress={isApproved ? onHide : onApprove}
        {...handlers}
        style={[
          styles.rowAction,
          { backgroundColor: colors.buttonSoft },
          focusRing(m.size.focusRing, colors.buttonInk, isFocused),
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          isApproved
            ? t("hideVideo", { title: labels.title(video) })
            : t("showVideo", { title: labels.title(video) })
        }
      >
        {isApproved ? (
          <EyeOff size={m.font(18)} color={colors.buttonInk} />
        ) : (
          <Eye size={m.font(18)} color={colors.buttonInk} />
        )}
      </Pressable>
    </View>
  );
}

const makeStyles = (m: Metrics) =>
  StyleSheet.create({
    screen: { flex: 1 },
    header: {
      paddingHorizontal: m.space.screenX,
      paddingBottom: m.space.gridGap,
      gap: m.space.meta,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: m.space.meta,
    },
    headerText: { flex: 1, minWidth: 0 },
    /** The phone's stack: the field, then the tabs, both the width of the screen. */
    headerControls: { width: "100%", gap: m.space.meta },
    /**
     * The field, on the title's line.
     *
     * Capped for the same reason the home header's is: a search field is not more useful
     * for being 900px wide, and letting it take the whole middle of the row would push the
     * title and the back button to opposite edges of the screen.
     */
    headerSearch: { flex: 1, maxWidth: 420 },
    /**
     * Tabs at one end, the parent's actions at the other.
     *
     * They are the two things on this screen that are neither the title nor the list, and
     * neither of them wants to grow — so putting them on one line with the space pushed
     * between costs a single row where the stacked version cost two, and the list starts
     * that much higher up.
     */
    controlsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: m.space.meta,
    },
    title: {
      ...m.type.cardTitle,
      fontSize: m.font(20),
      lineHeight: m.font(25),
      minHeight: 0,
    },
    count: m.type.muted,
    tabs: { flexDirection: "row", gap: m.font(8) },
    tab: {
      flex: 1,
      height: m.font(38),
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: m.space.meta,
    },
    /** Sized by its label rather than splitting the line, once it shares one. */
    tabWide: { flex: 0, paddingHorizontal: m.space.gridGap },
    tabLabel: { ...m.type.muted, fontFamily: m.type.cardTitle.fontFamily },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: m.space.meta,
      padding: m.space.card,
      borderRadius: m.radius.card,
      // The gap between rows lives here rather than on the content container: a recycling
      // list lays out each row on its own, so a container `gap` has nothing to apply to.
      marginBottom: m.space.meta,
    },
    // A 16:9 thumbnail at a width that leaves room for two lines of title beside it.
    rowThumb: { width: m.font(132), maxWidth: "40%" },
    rowText: { flex: 1, minWidth: 0 },
    rowTitle: {
      ...m.type.cardTitle,
      fontSize: m.font(14),
      lineHeight: m.font(18),
      minHeight: 0,
    },
    rowChannel: { ...m.type.muted, fontSize: m.font(12), lineHeight: m.font(16) },
    rowAction: {
      width: m.size.tapTarget,
      height: m.size.tapTarget,
      borderRadius: 999,
      alignItems: "center",
      justifyContent: "center",
    },
    empty: { ...m.type.muted, textAlign: "center", paddingVertical: 32 },
  });
