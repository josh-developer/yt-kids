import type { Video } from "@repo/catalog/types";
import { FlashList, type ListRenderItemInfo } from "@shopify/flash-list";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  type useAnimatedScrollHandler,
} from "react-native-reanimated";
import { CardReveal } from "./card-reveal";
import { VideoCard } from "../../../entities/video";
import { FocusZone } from "../../../shared/ui/focus-zone";
import { useDevice } from "../../../shared/lib/device/use-device";
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
 *
 * ### Recycling and the D-pad
 *
 * The two do not naturally get on, and this is the part of the TV work most likely to need
 * revisiting on real hardware. Android's focus search is geometric and looks for a view
 * that is *mounted*; a virtualised list frequently has not mounted the next row yet, and a
 * row that scrolls out is rebound to different data underneath the focus that was on it.
 *
 * Two things are done about it here. The list is wrapped in a `TVFocusGuideView`, so focus
 * arriving anywhere on the grid is redirected onto a card rather than falling through to
 * the root; and the first card asks for focus on mount, so the screen opens with the D-pad
 * somewhere useful. If that proves not to be enough, the honest fallback is `FlatList` on
 * TV with `removeClippedSubviews` off — the recycling argument was made against a
 * mid-range phone, and a television has memory to spare and no flick to keep up with.
 */
export function VideoGrid({
  videos,
  onOpenVideo,
  onScroll,
  topInset,
}: {
  videos: readonly Video[];
  onOpenVideo: (video: Video) => void;
  /** Absent where nothing above the list moves with it, as on the search screen. */
  onScroll?: ReturnType<typeof useAnimatedScrollHandler>;
  /** Height of the header the list scrolls underneath. */
  topInset: number;
}) {
  const { isTV } = useDevice();
  const { columns, gap } = useGridColumns();
  const { space, overscanY } = useMetrics();

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Video>) => (
      // Half the gap on each side of every cell, so the space *between* two columns adds
      // up to a whole one. The content container gives back the same half at the screen's
      // edges, which is what keeps the outer margin equal to `screenX` rather than one and
      // a half times it.
      <View
        style={[
          styles.cell,
          { paddingBottom: gap, paddingHorizontal: gap / 2 },
        ]}
      >
        <CardReveal column={index % columns}>
          <VideoCard
            video={item}
            priority={index < EAGER_CARDS}
            // Only ever true on the first mount of the first card: the prop is read when
            // the view is created, and a recycled view is not created again.
            hasTVPreferredFocus={isTV && index === 0}
            onOpen={onOpenVideo}
          />
        </CardReveal>
      </View>
    ),
    [columns, gap, isTV, onOpenVideo],
  );

  return (
    <FocusZone style={styles.zone} reclaimFocus>
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
          // Less the half-gap each cell carries; see the cell above.
          paddingHorizontal: space.screenX - gap / 2,
          // A television crops the bottom of the picture as readily as the top, so the
          // last row needs the overscan margin as well as the usual breathing room.
          paddingBottom: space.gridGap * 2 + overscanY,
        }}
        showsVerticalScrollIndicator={false}
      />
    </FocusZone>
  );
}

function keyExtractor(video: Video) {
  return video.id;
}

const styles = StyleSheet.create({
  zone: { flex: 1 },
  /** `flex: 1` is what makes a multi-column row split evenly. */
  cell: { flex: 1 },
});
