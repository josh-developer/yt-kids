import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Fragment, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import styles from "./virtual-grid.module.css";

const ESTIMATED_ROW_HEIGHT = 340;
const OVERSCAN_ROWS = 4;
/** Rendered before the browser measures, so the first paint is not blank. */
const INITIAL_ITEMS = 12;

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
  renderItem: (item: Item) => ReactNode;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(1);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [rowGap, setRowGap] = useState(0);
  const [isMeasured, setIsMeasured] = useState(false);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) {
      return;
    }

    const measure = () => {
      const style = window.getComputedStyle(grid);
      const columns = style.gridTemplateColumns
        .split(" ")
        .filter(Boolean).length;
      setColumnCount(Math.max(1, columns));
      setScrollMargin(grid.offsetTop);
      setRowGap(Number.parseFloat(style.rowGap) || 0);
    };

    measure();
    const frame = window.requestAnimationFrame(() => setIsMeasured(true));
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(grid);
    window.addEventListener("resize", measure);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const virtualizer = useWindowVirtualizer({
    count: Math.ceil(items.length / columnCount),
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN_ROWS,
    scrollMargin,
  });

  // The server has no layout to measure, so it renders a plain first screen
  // and the virtualizer takes over once the grid has been measured.
  if (!isMeasured) {
    return (
      <div ref={gridRef} className={className} aria-label={ariaLabel}>
        {items.slice(0, INITIAL_ITEMS).map((item) => (
          <Fragment key={getKey(item)}>{renderItem(item)}</Fragment>
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
            {items.slice(start, start + columnCount).map((item) => (
              <Fragment key={getKey(item)}>{renderItem(item)}</Fragment>
            ))}
          </div>
        );
      })}
    </div>
  );
}
