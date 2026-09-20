import { useVirtualizer } from "@tanstack/react-virtual";
import { Fragment, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import styles from "./virtual-grid.module.css";

const ESTIMATED_ROW_HEIGHT = 340;
const OVERSCAN_ROWS = 4;
/** Rendered before the browser measures, so the first paint is not blank. */
const INITIAL_ITEMS = 12;

/**
 * The grid itself does not always live in a page that scrolls the window —
 * the watch page's sheet scrolls internally instead, so its own recommendation
 * grid needs to virtualise against that, not against `window`. `[data-scroll-root]`
 * (set on the sheet — see `watch-sheet.module.css`) is how a container opts
 * into being that target; anything else, including the home page, falls back
 * to `document.scrollingElement`, which tracks the window the same way.
 *
 * Deliberately not "walk up to the nearest `overflow-y: auto` ancestor":
 * `overflow-x: clip` on `.appShell` makes its *computed* `overflow-y` resolve
 * to `auto` too, per the CSS overflow spec, even though nothing ever actually
 * scrolls there — that would have quietly pointed the home page grid at a
 * container that never fires a scroll event.
 */
function findScrollElement(node: HTMLElement | null): Element {
  return node?.closest("[data-scroll-root]") ?? document.scrollingElement ?? document.documentElement;
}

/**
 * Renders a CSS grid of items but mounts only the rows near the viewport, so a
 * library of several hundred videos does not put several hundred thumbnails in
 * the DOM.
 *
 * The column count is not configured: it is read back from the computed
 * `grid-template-columns`, so the CSS stays the single source of truth for the
 * responsive layout and this component only decides which rows exist.
 */
export function VirtualGrid<Item>({
  items,
  className,
  ariaLabel,
  getKey,
  renderItem,
}: {
  items: Item[];
  className: string;
  ariaLabel?: string;
  getKey: (item: Item) => string;
  renderItem: (item: Item, index: number) => ReactNode;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(1);
  const [scrollElement, setScrollElement] = useState<Element | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [rowGap, setRowGap] = useState(0);
  const [isMeasured, setIsMeasured] = useState(false);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) {
      return;
    }

    const measure = () => {
      const container = findScrollElement(grid);
      const style = window.getComputedStyle(grid);
      const columns = style.gridTemplateColumns
        .split(" ")
        .filter(Boolean).length;
      setColumnCount(Math.max(1, columns));
      setScrollElement(container);
      setScrollMargin(
        grid.getBoundingClientRect().top -
          container.getBoundingClientRect().top +
          container.scrollTop,
      );
      setRowGap(Number.parseFloat(style.rowGap) || 0);
    };

    // `getComputedStyle` and the bounding rects both force the browser to
    // settle layout. A resize fires them in bursts and the observer fires
    // again for every row the virtualiser mounts, so measuring is held to
    // one a frame.
    let pendingFrame = 0;
    const scheduleMeasure = () => {
      if (pendingFrame) {
        return;
      }

      pendingFrame = window.requestAnimationFrame(() => {
        pendingFrame = 0;
        measure();
      });
    };

    measure();
    const frame = window.requestAnimationFrame(() => setIsMeasured(true));
    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(grid);

    /*
    * Everything between the grid and the thing that scrolls it, and not as
    * belt-and-braces: `scrollMargin` is the grid's *position*, and the rows are
    * absolutely positioned against it. Anything above the grid that changes
    * height moves the grid without changing the grid's own size, which an
    * observer watching only the grid never sees — the offset goes stale, every
    * row is placed that much too high, and the list climbs over whatever it was
    * sitting below.
    *
    * On the watch sheet that "anything above" is the player. Its box is a CSS
    * aspect ratio, so on a fast connection it is the right height from the first
    * layout and this never comes up; in an in-app browser on a phone it settles
    * after the grid has already measured, and the recommendations end up drawn
    * over the video.
    */
    const container = findScrollElement(grid);
    for (
      let ancestor = grid.parentElement;
      ancestor && ancestor !== container;
      ancestor = ancestor.parentElement
    ) {
      resizeObserver.observe(ancestor);
    }

    window.addEventListener("resize", scheduleMeasure);
    /*
    * `window.resize` is not the whole story on a phone. An in-app browser
    * collapses and restores its own toolbars as you scroll, which resizes the
    * visual viewport — and the layout viewport, which is what `resize` reports,
    * does not always move with it.
    */
    window.visualViewport?.addEventListener("resize", scheduleMeasure);

    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(pendingFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.visualViewport?.removeEventListener("resize", scheduleMeasure);
    };
  }, []);

  const virtualizer = useVirtualizer({
    count: Math.ceil(items.length / columnCount),
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN_ROWS,
    scrollMargin,
    getScrollElement: () => scrollElement,
  });

  // The server has no layout to measure, so it renders a plain first screen
  // and the virtualizer takes over once the grid has been measured.
  if (!isMeasured) {
    return (
      <div ref={gridRef} className={className} aria-label={ariaLabel}>
        {items.slice(0, INITIAL_ITEMS).map((item, index) => (
          <Fragment key={getKey(item)}>{renderItem(item, index)}</Fragment>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={gridRef}
      className={className}
      aria-label={ariaLabel}
      style={{
        position: "relative",
        height: virtualizer.getTotalSize(),
        alignContent: "start",
      }}
    >
      {virtualizer.getVirtualItems().map((row) => {
        const start = row.index * columnCount;

        return (
          <div
            key={row.key}
            data-index={row.index}
            ref={virtualizer.measureElement}
            // Rows are absolutely positioned siblings, so a row whose measured
            // height is behind reality overlaps the one above it and swallows
            // taps meant for the cards there. Only the cards take pointer
            // events; the row itself is inert.
            className={`${className} ${styles.virtualGridRow}`}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              paddingBottom: rowGap,
              transform: `translateY(${row.start - virtualizer.options.scrollMargin}px)`,
            }}
          >
            {/* Fragments keep the rendered cards as direct grid children. */}
            {items.slice(start, start + columnCount).map((item, column) => (
              <Fragment key={getKey(item)}>
                {renderItem(item, start + column)}
              </Fragment>
            ))}
          </div>
        );
      })}
    </div>
  );
}
