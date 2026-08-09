import { useTranslations } from "next-intl";
import { useRef } from "react";
import type { PointerEvent } from "react";
import { formatTimestamp } from "@/shared/lib/time";
import styles from "./player.module.css";

export function PlayerProgress({
  currentTime,
  durationSeconds,
  onSeekToRatio,
  onScrubEnd,
}: {
  currentTime: number;
  durationSeconds: number;
  onSeekToRatio: (ratio: number) => void;
  onScrubEnd: () => void;
}) {
  const t = useTranslations("Player");
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
