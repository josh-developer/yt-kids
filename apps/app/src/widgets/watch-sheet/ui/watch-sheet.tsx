import type { ReactNode } from "react";
import { useWatchSheet } from "../model/use-watch-sheet";
import styles from "./watch-sheet.module.css";

/**
 * The watch page, presented as a sheet that slides up over whatever the app
 * was already showing rather than replacing it outright. Swiping it back
 * down hands control back to `onDismiss` — normally a navigation home — while
 * the sheet itself keeps rendering its last content until the slide-down
 * finishes.
 */
export function WatchSheet({
  isActive,
  onDismiss,
  children,
}: {
  isActive: boolean;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const { ref, isMounted, phase, isDragging, dragOffset, handlers } = useWatchSheet({
    isActive,
    onDismiss,
  });

  if (!isMounted) {
    return null;
  }

  return (
    <div
      ref={ref}
      className={`${styles.sheet} ${styles[phase]}`}
      style={isDragging ? { transform: `translateY(${dragOffset}px)` } : undefined}
      data-dragging={isDragging ? "" : undefined}
      // Lets `VirtualGrid` (shared/ui/virtual-grid.tsx) find this as its
      // scroll container instead of assuming the window scrolls.
      data-scroll-root=""
      {...handlers}
    >
      <div className={styles.sheetContent}>{children}</div>
    </div>
  );
}
