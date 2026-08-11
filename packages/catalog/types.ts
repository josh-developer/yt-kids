/**
 * The shape of a video, and of the catalog shipped with the apps.
 *
 * These live here rather than in the web app's `entities/video` because the data
 * in this package is typed by them, and a package cannot depend on the app that
 * consumes it. The web app re-exports them from `entities/video`, so its own
 * imports are unchanged and there is still one definition.
 *
 * Deliberately free of anything platform-specific: no DOM, no React, no Node.
 * A React Native app has to be able to import this file as-is.
 */
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
  accent: string;
  source: VideoSource;
};

/** A video from the shipped catalog, as opposed to one a parent added. */
export type CuratedVideo = Video & { source: "catalog" };
