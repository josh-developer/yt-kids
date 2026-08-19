import type { Video } from "@repo/catalog/types";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  type useAnimatedScrollHandler,
} from "react-native-reanimated";
import { CardReveal } from "./card-reveal";
import { VideoCard } from "../../../entities/video";
import { useGridColumns } from "../../../shared/lib/layout/use-grid-columns";
import { useMetrics } from "../../../shared/config/metrics";

/** Roughly a first screen; these fetch their images eagerly, as on the web. */
const EAGER_CARDS = 3;

const AnimatedFlashList = Animated.createAnimatedComponent(
  FlashList<Video>,
);

/**
 * The scrolling grid of cards.
 *
 * Column count comes from the window's size class through `useGridColumns` — one on a
 * phone, two or three where there is room, four across a television.
 *
 * `FlashList` rather than `FlatList`, because a flick through 400 cards is what this
 * screen is for. `FlatList` recycles nothing: it mounts and unmounts rows as the window
 * moves, so a fast scroll is a stream of mounts, and the phone that reported the lag was
 * paying for all of them. `FlashList` keeps a pool of views and rebinds them, which is
 * why it holds a frame rate a `FlatList` cannot.
 *
 * Version 2 measures rows itself, so there is no size to estimate — which suits a grid
 * whose row height already follows the window width.
 */
export function VideoGrid({
  videos,
  onOpenVideo,
  onScroll,
  topInset,
}: {
  videos: readonly Video[];
  onOpenVideo: (video: Video) => void;
  onScroll: ReturnType<typeof useAnimatedScrollHandler>;
  /** Height of the header the list scrolls underneath. */
  topInset: number;
}) {
  const { columns, gap } = useGridColumns();
  const { space, overscanY } = useMetrics();

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Video>) => (
      <View style={[styles.cell, { paddingBottom: gap }]}>
        <CardReveal column={index % columns}>
          <VideoCard
            video={item}
            priority={index < EAGER_CARDS}
            onOpen={onOpenVideo}
          />
        </CardReveal>
      </View>
    ),
    [columns, gap, onOpenVideo],
  );

  return (
    <AnimatedFlashList
      // Column count cannot change on a mounted list, so a rotation remounts it.
      key={`columns-${columns}`}
      data={videos as Video[]}
      numColumns={columns}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      onScroll={onScroll}
      // The header animation reads the shared value on the UI thread; this only feeds
      // the windowing, so per-frame JS events would buy nothing.
      scrollEventThrottle={16}
      // The header floats above, so the first card starts below it.
      contentContainerStyle={{
        paddingTop: topInset,
        paddingHorizontal: space.screenX,
        // A television crops the bottom of the picture as readily as the top, so the
        // last row needs the overscan margin as well as the usual breathing room.
        paddingBottom: space.gridGap * 2 + overscanY,
      }}
      showsVerticalScrollIndicator={false}
    />
  );
}

function keyExtractor(video: Video) {
  return video.id;
}

const styles = StyleSheet.create({
  /** `flex: 1` is what makes a multi-column row split evenly. */
  cell: { flex: 1, paddingHorizontal: 0 },
});
