import {
  Lock,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Unlock,
  VolumeX,
  WifiOff,
} from "lucide-react";
import { useTranslations } from "next-intl";
import type { MouseEvent, PointerEvent } from "react";
import { thumbnailUrl } from "@/shared/api/youtube";
import { SEEK_STEP_SECONDS } from "@/shared/config/app-config";
import { Tooltip } from "@/shared/ui/tooltip";
import { useVideoLabels, type Video } from "@/entities/video";
import type { PlayerFailure } from "../model/use-player-engine";
import type { SeekDirection } from "../model/use-player-gestures";
import styles from "./player.module.css";

/** Hover/focus on a previous or next button, or nothing. */
export type PreviewRequest = SeekDirection | null;

/**
 * Binds "show me what this button would play" to a button. Hover is limited to
 * a real mouse — a finger hovers nothing, and letting touch through would pop
 * the card up on the way to a tap that is about to navigate anyway.
 */
export function bindPreview(
  direction: SeekDirection,
  onPreview: (request: PreviewRequest) => void,
) {
  return {
    onPointerEnter: (event: PointerEvent<HTMLButtonElement>) => {
      if (event.pointerType === "mouse") {
        onPreview(direction);
      }
    },
    onPointerLeave: () => onPreview(null),
    onFocus: () => onPreview(direction),
    onBlur: () => onPreview(null),
  };
}

/** The card that says what the previous or next button is pointing at. */
export function VideoPreviewCard({
  direction,
  isVisible,
  video,
}: {
  direction: SeekDirection;
  isVisible: boolean;
  video: Video;
}) {
  const t = useTranslations("Player");
  const labels = useVideoLabels();

  return (
    <div
      className={`${styles.playerPreview} ${styles[direction]} ${isVisible ? "" : styles.hidden}`}
      aria-hidden="true"
    >
      <span className={styles.playerPreviewLabel}>
        {direction === "next" ? t("upNext") : t("previousVideo")}
      </span>
      <span className={styles.playerPreviewCard}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" loading="lazy" src={thumbnailUrl(video.videoId)} />
        <span className={styles.playerPreviewText}>
          <span className={styles.playerPreviewTitle}>{labels.title(video)}</span>
          <span className={styles.playerPreviewChannel}>
            {labels.channel(video)}
          </span>
        </span>
      </span>
    </div>
  );
}

/**
 * The end-of-video screen: what plays next, how long until it does, and the
 * two ways out — start it now, or watch this one again. The ring drains as the
 * count falls so the wait is visible rather than a number to be read.
 */
export function UpNextCountdown({
  secondsLeft,
  totalSeconds,
  video,
  onPlayNow,
  onReplay,
}: {
  secondsLeft: number;
  totalSeconds: number;
  video: Video;
  onPlayNow: () => void;
  onReplay: () => void;
}) {
  const t = useTranslations("Player");
  const labels = useVideoLabels();
  const progress = Math.max(0, Math.min(1, secondsLeft / totalSeconds));

  function stop(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();
  }

  return (
    <div className={styles.upNext} role="dialog" aria-label={t("upNext")}>
      <button
        className={styles.upNextCard}
        type="button"
        onClick={(event) => {
          stop(event);
          onPlayNow();
        }}
        onDoubleClick={stop}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt="" loading="lazy" src={thumbnailUrl(video.videoId)} />
        <span className={styles.upNextText}>
          <span className={styles.upNextLabel}>{t("upNext")}</span>
          <span className={styles.upNextTitle}>{labels.title(video)}</span>
        </span>
        <span
          className={styles.upNextRing}
          style={{ "--countdown-progress": progress }}
          aria-hidden="true"
        >
          {secondsLeft}
        </span>
      </button>

      <div className={styles.upNextActions}>
        <button
          className={styles.upNextButton}
          type="button"
          onClick={(event) => {
            stop(event);
            onReplay();
          }}
          onDoubleClick={stop}
        >
          <RotateCcw size={18} />
          {t("replay")}
        </button>
        <button
          className={styles.upNextButton}
          type="button"
          onClick={(event) => {
            stop(event);
            onPlayNow();
          }}
          onDoubleClick={stop}
        >
          {t("cancelAutoplay")}
        </button>
      </div>
    </div>
  );
}

/** Covers the embed while it boots, hiding YouTube's own loading chrome. */
export function PlayerSkeleton({ isVisible }: { isVisible: boolean }) {
  return (
    <div
      className={`${styles.playerSkeleton} ${isVisible ? "" : styles.hidden}`}
      aria-hidden="true"
    >
      <span className={styles.playerSkeletonSpinner} />
    </div>
  );
}

/**
 * Replaces YouTube's own error screen when the embed cannot play: a VPN or
 * network filter blocking the request, a region lock, or an owner who
 * disallows embedding. Offers the two moves that can actually help.
 */
export function PlayerFailureNotice({
  failure,
  hasNext,
  onRetry,
  onNext,
}: {
  failure: PlayerFailure;
  hasNext: boolean;
  onRetry: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("Player");

  return (
    <div className={styles.playerFailure} role="alert">
      <WifiOff size={38} aria-hidden="true" />
      <p className={styles.playerFailureTitle}>
        {failure === "blocked" ? t("blockedTitle") : t("unreachableTitle")}
      </p>
      <p className={styles.playerFailureBody}>
        {failure === "blocked" ? t("blockedBody") : t("unreachableBody")}
      </p>
      <div className={styles.playerFailureActions}>
        <button
          className={`${styles.playerFailureButton} ${styles.primary}`}
          onClick={(event) => {
            event.stopPropagation();
            onRetry();
          }}
          onDoubleClick={(event) => event.stopPropagation()}
          type="button"
        >
          <RotateCcw size={18} />
          {t("retry")}
        </button>
        {hasNext ? (
          <button
            className={styles.playerFailureButton}
            onClick={(event) => {
              event.stopPropagation();
              onNext();
            }}
            onDoubleClick={(event) => event.stopPropagation()}
            type="button"
          >
            <SkipForward size={18} />
            {t("nextVideo")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

/** Shown while muted: one obvious tap to get sound back. */
export function UnmuteButton({ onUnmute }: { onUnmute: () => void }) {
  const t = useTranslations("Player");

  return (
    <button
      className={styles.playerUnmuteButton}
      onClick={(event) => {
        event.stopPropagation();
        onUnmute();
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      type="button"
      aria-label={t("unmute")}
    >
      <VolumeX size={28} />
    </button>
  );
}

/** Hides the YouTube title bar, which links out of the app. */
export function TitleCover({ isControlsVisible }: { isControlsVisible: boolean }) {
  return (
    <div
      className={`${styles.youtubeTitleCover} ${isControlsVisible ? "" : styles.hidden}`}
      aria-hidden="true"
    />
  );
}

export function SeekHints({ hint }: { hint: SeekDirection | null }) {
  return (
    <div
      className={`${styles.seekZones} ${hint === "previous" ? styles.showPrevious : hint ? styles.showNext : ""}`}
      aria-hidden="true"
    >
      <span>-{SEEK_STEP_SECONDS}</span>
      <span>+{SEEK_STEP_SECONDS}</span>
    </div>
  );
}

export function LockButton({
  isLocked,
  onToggle,
}: {
  isLocked: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("Player");

  return (
    <button
      className={styles.playerLockButton}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      type="button"
      aria-label={isLocked ? t("unlockControls") : t("lockControls")}
      aria-pressed={isLocked}
    >
      {isLocked ? <Lock size={24} /> : <Unlock size={24} />}
    </button>
  );
}

export function SideNavButtons({
  hasNext,
  hasPrevious,
  onClick,
  onDoubleClick,
  onPreview,
}: {
  hasNext: boolean;
  hasPrevious: boolean;
  onClick: (direction: SeekDirection) => void;
  onDoubleClick: (direction: SeekDirection) => void;
  onPreview: (request: PreviewRequest) => void;
}) {
  const t = useTranslations("Player");

  function bind(direction: SeekDirection) {
    return {
      ...bindPreview(direction, onPreview),
      onClick: (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onClick(direction);
      },
      onDoubleClick: (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        onDoubleClick(direction);
      },
    };
  }

  return (
    <div className={styles.sidePlayerButtons} aria-label={t("controls")}>
      <Tooltip label={t("previousVideo")} isDisabled={!hasPrevious}>
        <button
          className={`${styles.sidePlayerButton} ${hasPrevious ? "" : styles.isDisabled}`}
          type="button"
          aria-disabled={!hasPrevious}
          aria-label={t("previousVideo")}
          {...bind("previous")}
        >
          <SkipBack size={24} fill="currentColor" />
        </button>
      </Tooltip>
      <Tooltip label={t("nextVideo")} isDisabled={!hasNext}>
        <button
          className={`${styles.sidePlayerButton} ${hasNext ? "" : styles.isDisabled}`}
          type="button"
          aria-disabled={!hasNext}
          aria-label={t("nextVideo")}
          {...bind("next")}
        >
          <SkipForward size={24} fill="currentColor" />
        </button>
      </Tooltip>
    </div>
  );
}

export function PlayerPoster({ videoId }: { videoId: string }) {
  return (
    <div className={styles.playerPoster}>
      {/*
        The largest paint on a watch page. It is on screen before the embed
        has a frame to show, so it is fetched at high priority rather than
        left to compete with everything else the player is starting.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        loading="eager"
        fetchPriority="high"
        src={thumbnailUrl(videoId, "poster")}
      />
    </div>
  );
}

export function BigPlayButton({
  isPlaying,
  isVisible,
  onClick,
}: {
  isPlaying: boolean;
  isVisible: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("Player");

  return (
    <Tooltip label={isPlaying ? t("pause") : t("play")} isDisabled={!isVisible}>
      <button
        className={`${styles.bigPlayButton} ${isVisible ? "" : styles.hidden}`}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        onDoubleClick={(event) => event.stopPropagation()}
        type="button"
        // Faded out rather than unmounted, so it must leave the tab order too.
        tabIndex={isVisible ? undefined : -1}
        aria-hidden={isVisible ? undefined : true}
        aria-label={isPlaying ? t("pause") : t("play")}
      >
        {isPlaying ? (
          <Pause size={30} fill="currentColor" />
        ) : (
          <Play size={30} fill="currentColor" />
        )}
      </button>
    </Tooltip>
  );
}
