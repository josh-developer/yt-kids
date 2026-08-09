export type VideoSource = "catalog" | "custom";

export type Video = {
  id: string;
  videoId: string;
  title: string;
  channel: string;
  duration: string;
  /** Raw view count. Formatted per locale at render time. */
  viewCount?: number;
  /** Shown instead of a view count when the source has no public count. */
  sourceLabel?: "playlist" | "youtube";
  /** Legacy pre-i18n display string, kept for libraries stored before v8. */
  views?: string;
  tags: string[];
  accent: string;
  source: VideoSource;
};
