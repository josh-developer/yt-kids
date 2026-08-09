import { useTranslations } from "next-intl";
import { useRef, useSyncExternalStore } from "react";
import type { PointerEvent } from "react";
import { formatTimestamp } from "@/shared/lib/time";
import type { PlaybackClock } from "../model/playback-clock";
import styles from "./player.module.css";

/**
 * The one component that redraws as the video plays: it subscribes to the play
 * head instead of taking it as a prop, so a tick stops here.
 */
export function PlayerProgress({
  clock,
  durationSeconds,
  onSeekToRatio,
  onScrubEnd,
}: {
  clock: PlaybackClock;
  durationSeconds: number;
  onSeekToRatio: (ratio: number) => void;
  onScrubEnd: () => void;
}) {
  const t = useTranslations("Player");
  const currentTime = useSyncExternalStore(clock.subscribe, clock.get, clock.get);
  const isScrubbing = useRef(false);
  const hasDuration = durationSeconds > 0;

  function seekFromPointer(
    clientX: number,
    element: HTMLButtonElement,
  ) {
    const rect = element.getBoundingClientRect();
    onSeekToRatio((clientX - rect.left) / rect.width);
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (!hasDuration) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    isScrubbing.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    seekFromPointer(event.clientX, event.currentTarget);
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!isScrubbing.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    seekFromPointer(event.clientX, event.currentTarget);
  }

  function handlePointerEnd(event: PointerEvent<HTMLButtonElement>) {
    if (!isScrubbing.current) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    isScrubbing.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onScrubEnd();
  }

  return (
    <div className={styles.playerProgressWrap}>
      <button
        className={styles.playerProgress}
        disabled={!hasDuration}
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        type="button"
        aria-label={t("seek")}
      >
        <span
          className={styles.playerProgressFill}
          style={{
            width: hasDuration
              ? `${Math.min(100, (currentTime / durationSeconds) * 100)}%`
              : "0%",
          }}
        />
      </button>
      <span className={styles.playerTime}>
        {formatTimestamp(currentTime)} /{" "}
        {hasDuration ? formatTimestamp(durationSeconds) : "--:--"}
      </span>
    </div>
  );
}
