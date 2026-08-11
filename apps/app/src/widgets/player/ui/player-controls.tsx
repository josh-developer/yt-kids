import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Repeat1,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { SEEK_STEP_SECONDS } from "@/shared/config/app-config";
import { bindPreview, type PreviewRequest } from "./player-overlays";
import styles from "./player.module.css";

const VOLUME_STEP = 10;

export function PlayerControls({
  hasNext,
  hasPrevious,
  isFullscreen,
  isMuted,
  isPlaying,
  isRepeatOne,
  volume,
  onNext,
  onPlayPause,
  onPrevious,
  onPreview,
  onToggleFullscreen,
  onToggleMute,
  onSeekBy,
  onToggleRepeat,
  onVolumeChange,
}: {
  hasNext: boolean;
  hasPrevious: boolean;
  isFullscreen: boolean;
  isMuted: boolean;
  isPlaying: boolean;
  isRepeatOne: boolean;
  volume: number;
  onNext: () => void;
  onPlayPause: () => void;
  onPrevious: () => void;
  onPreview: (request: PreviewRequest) => void;
  onSeekBy: (seconds: number) => void;
  onToggleFullscreen: () => void;
  onToggleMute: () => void;
  onToggleRepeat: () => void;
  onVolumeChange: (volume: number) => void;
}) {
  const t = useTranslations("Player");
  const isSilent = isMuted || volume === 0;

  return (
    <div className={styles.safePlayerControls} aria-label={t("controls")}>
      <div className={styles.footerTransportControls}>
        {/* Narrow layouts reach these through the on-video side buttons. */}
        <div className={styles.wideScreenVideoNav}>
          <button
            className={styles.playerControlButton}
            disabled={!hasPrevious}
            onClick={onPrevious}
            type="button"
            aria-label={t("previousVideo")}
            {...bindPreview("previous", onPreview)}
          >
            <SkipBack size={16} fill="currentColor" />
          </button>
          <button
            className={`${styles.playerControlButton} ${styles.primary}`}
            onClick={onPlayPause}
            type="button"
            aria-label={isPlaying ? t("pause") : t("play")}
          >
            {isPlaying ? (
              <Pause size={16} fill="currentColor" />
            ) : (
              <Play size={16} fill="currentColor" />
            )}
          </button>
          <button
            className={styles.playerControlButton}
            disabled={!hasNext}
            onClick={onNext}
            type="button"
            aria-label={t("nextVideo")}
            {...bindPreview("next", onPreview)}
          >
            <SkipForward size={16} fill="currentColor" />
          </button>
          <span className={styles.controlDivider} />
        </div>
        <button
          className={`${styles.playerControlButton} ${styles.seekStep}`}
          onClick={() => onSeekBy(-SEEK_STEP_SECONDS)}
          type="button"
          aria-label={t("back15")}
        >
          -{SEEK_STEP_SECONDS}
        </button>
        <button
          className={`${styles.playerControlButton} ${styles.seekStep}`}
          onClick={() => onSeekBy(SEEK_STEP_SECONDS)}
          type="button"
          aria-label={t("forward15")}
        >
          +{SEEK_STEP_SECONDS}
        </button>
        <span className={styles.controlDivider} />
      </div>
      <button
        className={styles.playerControlButton}
        onClick={onToggleMute}
        type="button"
        aria-label={isMuted ? t("unmute") : t("mute")}
      >
        {isSilent ? (
          <VolumeX size={16} />
        ) : volume < 50 ? (
          <Volume1 size={16} />
        ) : (
          <Volume2 size={16} />
        )}
      </button>
      <button
        className={`${styles.playerControlButton} ${styles.volumeStep}`}
        onClick={() => onVolumeChange(volume - VOLUME_STEP)}
        type="button"
        aria-label={t("volumeDown")}
      >
        -
      </button>
      <span
        className={styles.volumeMeter}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={volume}
        aria-label={t("volume", { value: volume })}
      >
        <span style={{ width: `${volume}%` }} />
      </span>
      <button
        className={`${styles.playerControlButton} ${styles.volumeStep}`}
        onClick={() => onVolumeChange(volume + VOLUME_STEP)}
        type="button"
        aria-label={t("volumeUp")}
      >
        +
      </button>
      <button
        className={`${styles.playerControlButton} ${styles.repeatButton} ${isRepeatOne ? styles.active : ""}`}
        onClick={onToggleRepeat}
        type="button"
        aria-label={isRepeatOne ? t("repeatOneEnabled") : t("repeatOneDisabled")}
        aria-pressed={isRepeatOne}
      >
        <Repeat1 size={18} />
      </button>
      <button
        className={`${styles.playerControlButton} ${styles.fullscreenButton}`}
        onClick={onToggleFullscreen}
        type="button"
        aria-label={isFullscreen ? t("exitFullScreen") : t("fullScreen")}
      >
        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
      </button>
    </div>
  );
}
