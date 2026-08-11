import type { Video } from "@repo/catalog/types";
import { useCallback, useMemo } from "react";
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
} from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { CardReveal } from "./card-reveal";
import { TOP_BAR_HEIGHT } from "../../top-bar/ui/top-bar";
import { CARD_METRICS, VideoCard } from "../../../entities/video";
import { useGridColumns } from "../../../shared/lib/layout/use-grid-columns";
import { space } from "../../../shared/config/theme";

/** Roughly a first screen; these fetch their images eagerly, as on the web. */
const EAGER_CARDS = 3;

/**
 * The scrolling grid of cards.
 *
 * Column count follows the web's breakpoints through `useGridColumns` — one on a
 * phone, more once the viewport is wide enough that a single card would be absurd.
 *
 * `FlatList` rather than a `ScrollView` because the catalog is 367 videos and every
 * row holds an image. The windowing numbers are deliberate rather than defaults,
 * and `getItemLayout` matters most: every row is the same height, so the list is
 * told instead of measuring, which is what makes scroll-to-offset exact and lets
 * the reveal animation work out where a card is from its index alone.
 */
export function VideoGrid({
  videos,
  onOpenVideo,
  header,
}: {
  videos: Video[];
  onOpenVideo: (video: Video) => void;
  header?: React.ReactElement;
}) {
  const { width, height } = useWindowDimensions();
  const { columns, gap } = useGridColumns();
  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  // Rows are a fixed height, so this is computed once per layout rather than
  // measured per row. Cards share the row's width minus the gaps between them.
  const rowHeight = useMemo(() => {
    const usable = width - space.screenX * 2 - gap * (columns - 1);
    return CARD_METRICS.estimatedHeight(usable / columns) + gap;
  }, [columns, gap, width]);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Video>) => (
      // `flex: 1` is what makes a multi-column row split evenly. Without it a
      // cell sizes to its content, claims the full row width, and the layout
      // collapses back to one visible card per row however many `numColumns`
      // says — which is exactly what it did.
      <View style={columns > 1 ? styles.cell : undefined}>
      <CardReveal
        // The reveal describes a row, not a cell: cards sharing a row arrive
        // together, exactly as they do in the browser.
        index={Math.floor(index / columns)}
        scrollY={scrollY}
        cardHeight={rowHeight}
        headerHeight={header ? TOP_BAR_HEIGHT : 0}
        viewportHeight={height}
      >
        <VideoCard
          video={item}
          priority={index < EAGER_CARDS}
          onOpen={onOpenVideo}
        />
      </CardReveal>
      </View>
    ),
    [columns, header, height, onOpenVideo, rowHeight, scrollY],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<Video> | null | undefined, index: number) => ({
      length: rowHeight,
      offset: rowHeight * Math.floor(index / columns),
      index,
    }),
    [columns, rowHeight],
  );

  return (
    <Animated.FlatList
      // `numColumns` cannot change on a mounted list, so a rotation remounts it.
      key={`columns-${columns}`}
      data={videos}
      numColumns={columns}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      getItemLayout={getItemLayout}
      onScroll={onScroll}
      // The animation reads the shared value on the UI thread; this only feeds
      // the windowing, so per-frame JS events would buy nothing.
      scrollEventThrottle={16}
      ListHeaderComponent={header}
      contentContainerStyle={styles.content}
      columnWrapperStyle={columns > 1 ? { gap } : undefined}
      ItemSeparatorComponent={columns > 1 ? undefined : () => <Row gap={gap} />}
      showsVerticalScrollIndicator={false}
      // Windowing, tuned for rows that each hold a decoding image: enough ahead
      // to hide the fetch, not so much that a flick mounts dozens.
      initialNumToRender={4 * columns}
      maxToRenderPerBatch={6 * columns}
      windowSize={7}
      updateCellsBatchingPeriod={40}
      // Frees offscreen rows' native views. A real win over 367 rows, and safe
      // because a row has no state to lose.
      removeClippedSubviews
    />
  );
}

function keyExtractor(video: Video) {
  return video.id;
}

/**
 * The gap between rows. `columnWrapperStyle`'s `gap` already spaces multi-column
 * rows in both directions, so this only runs in the single-column case.
 */
function Row({ gap }: { gap: number }) {
  return <View style={{ height: gap }} />;
}

const styles = StyleSheet.create({
  cell: { flex: 1 },
  content: {
    paddingHorizontal: space.screenX,
    paddingBottom: space.gridGap * 2,
  },
});
