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

class WebStorageStore implements KeyValueStore {
  constructor(private readonly storage: () => Storage) {}

  read(key: string) {
    try {
      return this.storage().getItem(key);
    } catch {
      // Private-mode Safari throws on access rather than returning null.
      return null;
    }
  }

  write(key: string, value: string) {
    try {
      this.storage().setItem(key, value);
    } catch {
      // Out of quota: the app still works for this session.
    }
  }

  remove(key: string) {
    try {
      this.storage().removeItem(key);
    } catch {
      // Nothing to clean up if the store is unavailable.
    }
  }
}

export class LocalStorageStore extends WebStorageStore {
  constructor() {
    super(() => window.localStorage);
  }
}

/** Cleared when the tab closes; used for per-session player preferences. */
export class SessionStorageStore extends WebStorageStore {
  constructor() {
    super(() => window.sessionStorage);
  }
}

/** `LocalStorageStore` in the browser, an in-memory stand-in on the server. */
export function createBrowserStore(): KeyValueStore {
  return typeof window === "undefined"
    ? new MemoryStore()
    : new LocalStorageStore();
}

/** `SessionStorageStore` in the browser, an in-memory stand-in on the server. */
export function createSessionStore(): KeyValueStore {
  return typeof window === "undefined"
    ? new MemoryStore()
    : new SessionStorageStore();
}
