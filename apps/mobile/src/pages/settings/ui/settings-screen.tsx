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
import { IconButton, useIconColor } from "../../../shared/ui/icon-button";
import { useTheme } from "../../../shared/lib/theme/use-theme";
import { useTranslations } from "../../../shared/lib/i18n/use-translations";
import { useVideoLabels } from "../../../shared/lib/format/use-video-labels";
import { matchesQuery } from "../../../shared/lib/format/matches-query";
import { radius, space, type } from "../../../shared/config/theme";

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
 */
export function SettingsScreen({
  library,
  onBack,
}: {
  library: LibraryController;
  onBack: () => void;
}) {
  const { colors, name } = useTheme();
  const insets = useSafeAreaInsets();
  const t = useTranslations("Settings");
  const iconColor = useIconColor();
  const [tab, setTab] = useState<Tab>("approved");
  const [query, setQuery] = useState("");

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

      <View style={[styles.header, { paddingTop: insets.top + space.meta }]}>
        <View style={styles.headerRow}>
          <IconButton label={t("close")} onPress={onBack}>
            <ArrowLeft size={19} color={iconColor} />
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

      {/* `FlashList`, for the same reason as the home grid: this is 400-odd rows and a
          parent scrolls it looking for one video. Recycled views keep a frame rate that
          mounting and unmounting rows cannot. */}
      <FlashList
        data={results}
        keyExtractor={(video) => video.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textSoft }]}>
            {t("noVideosFound", { tab })}
          </Text>
        }
        renderItem={({ item }) => (
          <SettingsRow
            video={item}
            isApproved={tab === "approved"}
            onApprove={() => library.approve(item.id)}
            onHide={() => library.hide(item.id)}
          />
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

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.tab,
        {
          backgroundColor: isActive ? colors.buttonActive : colors.buttonSoft,
        },
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
        style={[styles.rowAction, { backgroundColor: colors.buttonSoft }]}
        accessibilityRole="button"
        accessibilityLabel={
          isApproved
            ? t("hideVideo", { title: labels.title(video) })
            : t("showVideo", { title: labels.title(video) })
        }
      >
        {isApproved ? (
          <EyeOff size={18} color={colors.buttonInk} />
        ) : (
          <Eye size={18} color={colors.buttonInk} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: space.screenX,
    paddingBottom: space.gridGap,
    gap: space.meta,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: space.meta },
  headerText: { flex: 1, minWidth: 0 },
  title: { ...type.cardTitle, fontSize: 20, lineHeight: 25, minHeight: 0 },
  count: type.muted,
  tabs: { flexDirection: "row", gap: 8 },
  tab: {
    flex: 1,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  tabLabel: { ...type.muted, fontFamily: type.cardTitle.fontFamily },
  list: {
    paddingHorizontal: space.screenX,
    paddingBottom: space.gridGap * 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.meta,
    padding: space.card,
    borderRadius: radius.card,
    // The gap between rows lives here rather than on the content container: a recycling
    // list lays out each row on its own, so a container `gap` has nothing to apply to.
    marginBottom: space.meta,
  },
  // A 16:9 thumbnail at a width that leaves room for two lines of title beside it.
  rowThumb: { width: 132 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { ...type.cardTitle, fontSize: 14, lineHeight: 18, minHeight: 0 },
  rowChannel: { ...type.muted, fontSize: 12, lineHeight: 16 },
  rowAction: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: { ...type.muted, textAlign: "center", paddingVertical: 32 },
});
