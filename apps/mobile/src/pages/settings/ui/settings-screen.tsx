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
import { ParentActions } from "../../../features/library-transfer/ui/parent-actions";
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
  const { isWide } = useDevice();
  const insets = useSafeAreaInsets();
  const t = useTranslations("Settings");
  const iconColor = useIconColor();
  const iconSize = useIconSize();
  const m = useMetrics();
  const styles = useStyles(makeStyles);
  const [tab, setTab] = useState<Tab>("approved");
  const [query, setQuery] = useState("");

  const columns = isWide ? 2 : 1;

  const results = useMemo(() => {
    const pool =
      tab === "approved" ? library.approvedVideos : library.hiddenVideos;
    return pool.filter((video) => matchesQuery(video, query));
  }, [library.approvedVideos, library.hiddenVideos, query, tab]);

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
        </View>

        <View style={styles.headerControls}>
          <VideoSearchField
            query={query}
            onQueryChange={setQuery}
            onSubmit={() => undefined}
          />

          <View style={styles.tabs}>
            <TabButton
              label={t("approvedTab")}
              count={library.approvedVideos.length}
              isActive={tab === "approved"}
              onPress={() => setTab("approved")}
            />
            <TabButton
              label={t("hiddenTab")}
              count={library.hiddenVideos.length}
              isActive={tab === "hidden"}
              onPress={() => setTab("hidden")}
            />
          </View>
        </View>
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

      {/* Export, import, add and reset, behind one button in the corner. */}
      <ParentActions library={library} />
    </View>
  );
}

function TabButton({
  label,
  count,
  isActive,
  onPress,
}: {
  label: string;
  count: number;
  isActive: boolean;
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
    /**
     * The search field and the tabs stay a phone's width even on a tablet. Neither reads
     * better for being stretched across a metre of glass, and holding them together keeps
     * the eye's path from the title to the list short.
     */
    headerControls: { width: "100%", maxWidth: 560, gap: m.space.meta },
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
