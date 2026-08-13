import { useCallback, useEffect, useRef, useState } from "react";
import SystemVolume from "../../../../modules/system-volume";

/** One press of the plus or minus button. Ten steps across the range. */
const STEP = 0.1;
/**
 * A dragging finger asks for a new volume on every frame; anything finer than this is
 * below what a device's volume steps can represent anyway, and each write crosses the
 * bridge to the platform's audio service.
 */
const WRITE_GRANULARITY = 0.02;

/**
 * The device's media volume, and the two ways the player changes it.
 *
 * Live rather than a stored copy: the hardware keys, the Control Centre and another
 * app's slider all move the same number, and a slider showing a remembered value
 * instead of the real one is worse than no slider. The subscription is what keeps them
 * agreeing.
 *
 * There is nothing to persist. The device already remembers its volume, which is also
 * what makes "the sound stays on for the next video" true without any work: the player
 * never mutes itself, so the only thing that can silence it is the viewer.
 */
export function useSystemVolume() {
  const [volume, setVolume] = useState(() => SystemVolume.getVolume());
  const lastWritten = useRef(volume);

  useEffect(() => {
    const subscription = SystemVolume.addListener("onVolumeChange", (event) => {
      setVolume(event.volume);
    });

    return () => subscription.remove();
  }, []);

  const change = useCallback((next: number) => {
    const clamped = Math.min(1, Math.max(0, next));
    // Optimistic: the native change is asynchronous, and a slider that waits for a
    // round trip before it moves feels broken under a finger.
    setVolume(clamped);

    const isAtEnd = clamped === 0 || clamped === 1;
    if (
      !isAtEnd &&
      Math.abs(clamped - lastWritten.current) < WRITE_GRANULARITY
    ) {
      return;
    }

    lastWritten.current = clamped;
    void SystemVolume.setVolume(clamped);
  }, []);

  const nudge = useCallback(
    (direction: 1 | -1) => {
      change(volume + direction * STEP);
    },
    [change, volume],
  );

  return { volume, change, nudge };
}
