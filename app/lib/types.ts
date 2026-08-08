export type Theme = "dark" | "light";
export type Language = "en" | "uz";

export type FullscreenHostElement = HTMLDivElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export type FullscreenHostDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenElement?: Element | null;
};

export type OrientationWithLock = ScreenOrientation & {
  lock?: (orientation: OrientationLockType) => Promise<void>;
  unlock?: () => void;
};

export type AppRoute =
  | { view: "home"; query: string }
  | { view: "settings" }
  | { view: "watch"; videoId: string };

export type Video = {
  id: string;
  videoId: string;
  title: string;
  channel: string;
  duration: string;
  views: string;
  tags: string[];
  accent: string;
  source: "catalog" | "custom";
};

export type StoredLibrary = {
  version: number;
  selectedIds: string[];
  customVideos: Video[];
  removedIds: string[];
};

export type WatchStack = {
  ids: string[];
  index: number;
};

export type YouTubeMetadata = {
  title?: string;
  channel?: string;
  duration?: string;
  durationSeconds?: number;
};

export type YouTubePlaylist = {
  videoIds?: string[];
};
