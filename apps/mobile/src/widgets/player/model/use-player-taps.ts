import { useCallback, useEffect, useRef } from "react";
import type { GestureResponderEvent } from "react-native";

/**
 * A single tap waits this long to see whether a second one is coming.
 *
 * `CLICK_SETTLE_MS` in the web's `use-player-gestures.ts` is 220ms, which is too tight for
 * a thumb: a real double tap lands 250-350ms apart, so the first tap's toggle had already
 * fired and the second one toggled it back — the controls flashing on and off instead of
 * the video seeking. 320ms is inside the platform double-tap window and outside a human
 * one, and the cost of the extra 100ms is that a single tap acts a hair later.
 */
const SETTLE_MS = 320;
/** Beyond the middle of the video, a double tap is a seek rather than nothing. */
const SIDE_EDGE = 0.35;

/**
 * Taps over the video: one toggles the controls, two on a side seek.
 *
 * React Native's own touch responder rather than Gesture Handler, which is not a
 * preference. The video is a WebView, and a WebView consumes touches in native code
 * before Gesture Handler's per-view recognisers see them — the responder system runs from
 * the root view instead, so it still gets them. That is the whole reason this is hand-
 * rolled rather than a `Gesture.Exclusive(doubleTap, singleTap)`, which is what it would
 * otherwise be.
 *
 * The shape then follows the web's `usePlayerGestures` closely, timers included, so the
 * two behave the same: a settle window that a second tap cancels, and a dead zone in the
 * middle third so a mistimed double tap in the centre does not jump the video.
 */
export function usePlayerTaps({
  isLocked,
  width,
  seekStep,
  onSeekBy,
  onToggleControls,
}: {
  /** A locked player ignores the surface entirely; only its lock button answers. */
  isLocked: boolean;
  /** The video's width, which is what makes a touch position a side. */
  width: number;
  seekStep: number;
  onSeekBy: (seconds: number) => void;
  onToggleControls: () => void;
}) {
  const lastTapAt = useRef(0);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (settle.current) {
        clearTimeout(settle.current);
      }
    };
  }, []);

  const onTouchEnd = useCallback(
    (event: GestureResponderEvent) => {
      if (isLocked) {
        return;
      }

      const x = event.nativeEvent.locationX;
      const now = Date.now();
      const isSecondTap = now - lastTapAt.current < SETTLE_MS;

      if (settle.current) {
        clearTimeout(settle.current);
        settle.current = null;
      }

      if (isSecondTap) {
        lastTapAt.current = 0;
        const across = width > 0 ? x / width : 0.5;

        if (across < SIDE_EDGE) {
          onSeekBy(-seekStep);
        } else if (across > 1 - SIDE_EDGE) {
          onSeekBy(seekStep);
        }

        return;
      }

      lastTapAt.current = now;
      settle.current = setTimeout(() => {
        settle.current = null;
        onToggleControls();
      }, SETTLE_MS);
    },
    [isLocked, onSeekBy, onToggleControls, seekStep, width],
  );

  return { onTouchEnd };
}
