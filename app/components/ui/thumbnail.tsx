"use client";

import type { Video } from "../../lib/types";
import { thumbnailUrl } from "../../lib/youtube";

export function Thumbnail({ video }: { video: Video }) {
  return (
    <span className="thumbnail">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        loading="lazy"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
        src={thumbnailUrl(video.videoId)}
      />
      <span className="duration">{video.duration}</span>
    </span>
  );
}
