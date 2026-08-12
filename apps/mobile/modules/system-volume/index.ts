import { NativeModule, requireNativeModule } from "expo";

/** A volume between 0 and 1, as both platforms report it. */
export type VolumeChangeEvent = { volume: number };

type SystemVolumeEvents = {
  onVolumeChange(event: VolumeChangeEvent): void;
};

declare class SystemVolumeNativeModule extends NativeModule<SystemVolumeEvents> {
  /**
   * iOS: puts the audio session into playback, so the ringer switch cannot silence a
   * video. A no-op on Android.
   */
  configureForPlayback(): Promise<void>;
  getVolume(): number;
  setVolume(volume: number): Promise<void>;
}

/**
 * The device's media volume.
 *
 * The player's slider moves this rather than a volume of its own, because on iOS there
 * is no other kind: WKWebView ignores an HTML5 `volume` assignment, so the YouTube
 * iframe API cannot change it. Android could have done both; one meaning for one slider
 * is worth more than a per-app volume on half the installs.
 */
export default requireNativeModule<SystemVolumeNativeModule>("SystemVolume");
