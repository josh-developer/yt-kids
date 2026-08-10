/**
 * Every user-facing string the player renders, injectable so the component
 * stays translation-agnostic (shared/ui takes strings as props). The English
 * defaults make the component usable standalone; callers merge translated
 * values over them.
 */
export type KidVideoPlayerLabels = {
  play: string;
  pause: string;
  mute: string;
  unmute: string;
  seek: string;
  enterFullscreen: string;
  exitFullscreen: string;
  nextVideo: string;
  previousVideo: string;
  lockControls: string;
  unlockControls: string;
  back15: string;
  forward15: string;
  repeatOn: string;
  repeatOff: string;
  /** Accessible name for the whole player region, pre-interpolated. */
  surface: string;
};

export const DEFAULT_KID_VIDEO_PLAYER_LABELS: KidVideoPlayerLabels = {
  play: "Play",
  pause: "Pause",
  mute: "Mute",
  unmute: "Unmute",
  seek: "Seek",
  enterFullscreen: "Full screen",
  exitFullscreen: "Exit full screen",
  nextVideo: "Next video",
  previousVideo: "Previous video",
  lockControls: "Lock controls",
  unlockControls: "Unlock controls",
  back15: "Go back 15 seconds",
  forward15: "Go forward 15 seconds",
  repeatOn: "Repeat one enabled",
  repeatOff: "Repeat one disabled",
  surface: "Video player",
};
