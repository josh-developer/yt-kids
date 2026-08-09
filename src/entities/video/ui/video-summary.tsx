"use client";

import { useVideoLabels } from "../model/use-video-labels";
import type { Video } from "../model/types";

/** Title / channel / views triple, shared by the grid and the sidebar. */
export function VideoSummary({ video }: { video: Video }) {
  const labels = useVideoLabels();

  return (
    <span>
      <span className="video-title">{labels.title(video)}</span>
      <span className="video-subline">{labels.channel(video)}</span>
      <span className="video-subline">{labels.views(video)}</span>
    </span>
  );
}
