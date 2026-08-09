export type { Video, VideoSource } from "./model/types";
export {
  CUSTOM_VIDEO_ACCENT,
  UNKNOWN_DURATION,
  createCustomVideo,
  customVideoId,
  matchesQuery,
} from "./model/video-factory";
export {
  episodeNumberOf,
  isSameSeries,
  isSimilar,
  signatureSimilarity,
  titleSignature,
} from "./model/video-similarity";
export type { TitleSignature } from "./model/video-similarity";
export { useVideoLabels } from "./model/use-video-labels";
export type { VideoLabels } from "./model/use-video-labels";
export { ChannelAvatar } from "./ui/channel-avatar";
export { VideoCard } from "./ui/video-card";
export { VideoSummary } from "./ui/video-summary";
export { VideoThumbnail } from "./ui/video-thumbnail";
