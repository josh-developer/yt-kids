import { Lock, Pause, Play, SkipBack, SkipForward, Unlock } from "lucide-react";
import { useTranslations } from "next-intl";
import type { MouseEvent } from "react";
import { thumbnailUrl } from "@/shared/api/youtube";
import { SEEK_STEP_SECONDS } from "@/shared/config/app-config";
import type { SeekDirection } from "../model/use-player-gestures";

/** Hides the YouTube title bar, which links out of the app. */
export function TitleCover({ isControlsVisible }: { isControlsVisible: boolean }) {
  return (
    <div
      className={`youtube-title-cover ${isControlsVisible ? "" : "hidden"}`}
      aria-hidden="true"
    />
  );
}

export function SeekHints({ hint }: { hint: SeekDirection | null }) {
  return (
    <div
      className={`seek-zones ${hint ? `show-${hint}` : ""}`}
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
      className="player-lock-button"
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
}: {
  hasNext: boolean;
  hasPrevious: boolean;
  onClick: (direction: SeekDirection) => void;
  onDoubleClick: (direction: SeekDirection) => void;
}) {
  const t = useTranslations("Player");

  function bind(direction: SeekDirection) {
    return {
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
    <div className="side-player-buttons" aria-label={t("controls")}>
      <button
        className={`side-player-button left ${hasPrevious ? "" : "is-disabled"}`}
        type="button"
        aria-disabled={!hasPrevious}
        aria-label={t("previousVideo")}
        {...bind("previous")}
      >
        <SkipBack size={24} fill="currentColor" />
      </button>
      <button
        className={`side-player-button right ${hasNext ? "" : "is-disabled"}`}
        type="button"
        aria-disabled={!hasNext}
        aria-label={t("nextVideo")}
        {...bind("next")}
      >
        <SkipForward size={24} fill="currentColor" />
      </button>
    </div>
  );
}

export function PlayerPoster({ videoId }: { videoId: string }) {
  return (
    <div className="player-poster">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={thumbnailUrl(videoId)} />
    </div>
  );
}

export function BigPlayButton({
  isPlaying,
  onClick,
}: {
  isPlaying: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("Player");

  return (
    <button
      className="big-play-button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      onDoubleClick={(event) => event.stopPropagation()}
      type="button"
      aria-label={isPlaying ? t("pause") : t("play")}
    >
      {isPlaying ? (
        <Pause size={30} fill="currentColor" />
      ) : (
        <Play size={30} fill="currentColor" />
      )}
    </button>
  );
}
