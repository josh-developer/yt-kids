/**
 * Named timer handles with one place to cancel them. Replaces the
 * "ref holding a handle + null check before every clear" pattern that the
 * player repeated for each of its seven timers.
 */
export class TimerBag {
  private readonly handles = new Map<string, number>();

  timeout(name: string, callback: () => void, delayMs: number) {
    this.clear(name);
    this.handles.set(
      name,
      window.setTimeout(() => {
        this.handles.delete(name);
        callback();
      }, delayMs),
    );
  }

  interval(name: string, callback: () => void, intervalMs: number) {
    this.clear(name);
    this.handles.set(name, window.setInterval(callback, intervalMs));
  }

  has(name: string) {
    return this.handles.has(name);
  }

  clear(name: string) {
    const handle = this.handles.get(name);
    if (handle === undefined) {
      return;
    }

    window.clearTimeout(handle);
    window.clearInterval(handle);
    this.handles.delete(name);
  }

  clearAll() {
    for (const name of [...this.handles.keys()]) {
      this.clear(name);
    }
  }
}
