"use client";

import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState } from "react";
import type { CopyText } from "../../lib/copy";
import type { Video } from "../../lib/types";
import { SafeYouTubePlayer } from "../player/safe-youtube-player";
import { Thumbnail } from "../ui/thumbnail";

function RecommendationsList({
  copy,
  recommendations,
  onOpenVideo,
}: {
  copy: CopyText;
  recommendations: Video[];
  onOpenVideo: (video: Video) => void;
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

  const rowCount = Math.ceil(recommendations.length / columnCount);

  const rowVirtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => 340,
    overscan: 4,
    scrollMargin,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div
      ref={gridRef}
      className="recommendations"
      aria-label={copy.playRecommendedVideo}
      style={{
        position: "relative",
        height: rowVirtualizer.getTotalSize(),
      }}
    >
      {virtualRows.map((virtualRow) => {
        const start = virtualRow.index * columnCount;
        const rowItems = recommendations.slice(start, start + columnCount);
        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={rowVirtualizer.measureElement}
            className="recommendations"
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
            {rowItems.map((item) => (
              <button
                className="recommendation-card"
                key={item.id}
                type="button"
                onClick={() => onOpenVideo(item)}
              >
                <Thumbnail video={item} />
                <span>
                  <span className="video-title">{item.title}</span>
                  <span className="video-subline">{item.channel}</span>
                  <span className="video-subline">{item.views}</span>
                </span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function WatchView({
  copy,
  isTvBrowser,
  nextVideo,
  previousVideo,
  recommendations,
  showRecommendations,
  video,
  onDurationResolved,
  onFullscreenChange,
  onNextVideo,
  onOpenVideo,
  onPreviousVideo,
  onToggleRecommendations,
}: {
  copy: CopyText;
  isTvBrowser: boolean;
  nextVideo: Video | null;
  previousVideo: Video | null;
  recommendations: Video[];
  showRecommendations: boolean;
  video: Video;
  onDurationResolved: (video: Video, seconds: number) => void;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  onNextVideo: () => void;
  onOpenVideo: (video: Video) => void;
  onPreviousVideo: () => void;
  onToggleRecommendations: () => void;
}) {
  return (
    <div className="watch-layout">
      <article>
        <SafeYouTubePlayer
          copy={copy}
          isTvBrowser={isTvBrowser}
          nextVideo={nextVideo}
          previousVideo={previousVideo}
          video={video}
          onDurationResolved={onDurationResolved}
          onFullscreenChange={onFullscreenChange}
          onNextVideo={onNextVideo}
          onPreviousVideo={onPreviousVideo}
        />
        <h1 className="watch-title">{video.title}</h1>
        <div className="watch-bar">
          <div className="channel-line">
            <span className="avatar" style={{ "--avatar": video.accent }}>
              {video.channel.slice(0, 1)}
            </span>
            <div>
              <strong>{video.channel}</strong>
              <div className="muted">{video.views}</div>
            </div>
          </div>
        </div>
      </article>

      <aside className="recommendations-panel">
        <div className="recommendations-header">
          <span className="recommendations-title">{copy.recommendations}</span>
          <label className="switch">
            <input
              checked={showRecommendations}
              type="checkbox"
              onChange={onToggleRecommendations}
            />
            <span className="switch-track" aria-hidden="true" />
            <span className="sr-only">{copy.showRecommendations}</span>
          </label>
        </div>

        {showRecommendations ? (
          <RecommendationsList
            copy={copy}
            recommendations={recommendations}
            onOpenVideo={onOpenVideo}
          />
        ) : null}
      </aside>
    </div>
  );
}
