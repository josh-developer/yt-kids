/**
 * The play head, deliberately kept outside React state.
 *
 * It moves about five times a second — once per telemetry packet from the
 * embed, plus our own tick between them — and exactly one component draws it.
 * Held in state it would re-render the whole player at that rate: the control
 * bar, both scrims, the side buttons, the centre button, every overlay, all to
 * redraw a number none of them show. As a subscription, a tick reaches the
 * progress bar and stops there.
 */
export class PlaybackClock {
  private seconds = 0;
  private readonly listeners = new Set<() => void>();

  /** Bound so it can be handed straight to `useSyncExternalStore`. */
  readonly get = () => this.seconds;

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  set(seconds: number) {
    if (seconds === this.seconds) {
      return;
    }

    this.seconds = seconds;
    for (const listener of this.listeners) {
      listener();
    }
  }
}
