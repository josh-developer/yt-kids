"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CopyText } from "../../lib/copy";
import type { Video } from "../../lib/types";
import { VideoCard } from "../video-card";

export function HomeView({
  copy,
  videos,
  onOpenVideo,
  onSettings,
}: {
  copy: CopyText;
  videos: Video[];
  onOpenVideo: (video: Video) => void;
  onSettings: () => void;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(1);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [rowGap, setRowGap] = useState(0);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const measure = () => {
      const style = window.getComputedStyle(grid);
      const columns = style.gridTemplateColumns.split(" ").filter(Boolean).length;
      setColumnCount(Math.max(1, columns));
      setScrollMargin(grid.offsetTop);
      setRowGap(Number.parseFloat(style.rowGap) || 0);
    };

    measure();
    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(grid);
    window.addEventListener("resize", measure);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const rowCount = Math.ceil(videos.length / columnCount);

  const rowVirtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => 340,
    overscan: 4,
    scrollMargin,
  });

  if (videos.length === 0) {
    return (
      <div className="empty-state">
        <div>
          <h2>{copy.noApprovedVideos}</h2>
          <p className="muted">{copy.addVideosFromSettings}</p>
          <button
            className="primary-button"
            type="button"
            onClick={onSettings}
            data-tooltip={copy.openSettings}
          >
            <Plus size={18} />
            {copy.openSettings}
          </button>
        </div>
      </div>
    );
  }

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div
      ref={gridRef}
      className="video-grid"
      style={{
        position: "relative",
        height: rowVirtualizer.getTotalSize(),
        alignContent: "start",
      }}
    >
      {virtualRows.map((virtualRow) => {
        const start = virtualRow.index * columnCount;
        const rowVideos = videos.slice(start, start + columnCount);
        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={rowVirtualizer.measureElement}
            className="video-grid"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              paddingBottom: rowGap,
              transform: `translateY(${
                virtualRow.start - rowVirtualizer.options.scrollMargin
              }px)`,
            }}
          >
            {rowVideos.map((video) => (
              <VideoCard key={video.id} video={video} onOpen={onOpenVideo} />
            ))}
          </div>
        );
      })}
    </div>
  );
}
