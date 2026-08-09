/**
 * Storage seam. Everything that persists goes through this interface so the
 * domain never talks to `window.localStorage` directly, which keeps it usable
 * on the server and in tests.
 */
export interface KeyValueStore {
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
}

export class MemoryStore implements KeyValueStore {
  private readonly entries = new Map<string, string>();

  read(key: string) {
    return this.entries.get(key) ?? null;
  }

  write(key: string, value: string) {
    this.entries.set(key, value);
  }

  remove(key: string) {
    this.entries.delete(key);
  }
}

export class LocalStorageStore implements KeyValueStore {
  read(key: string) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      // Private-mode Safari throws on access rather than returning null.
      return null;
    }
  }

  write(key: string, value: string) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      // Out of quota: the app still works for this session.
    }
  }

  remove(key: string) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Nothing to clean up if the store is unavailable.
    }
  }
}

/** `LocalStorageStore` in the browser, an in-memory stand-in on the server. */
export function createBrowserStore(): KeyValueStore {
  return typeof window === "undefined"
    ? new MemoryStore()
    : new LocalStorageStore();
}
