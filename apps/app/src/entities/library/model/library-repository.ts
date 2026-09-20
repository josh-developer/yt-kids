import { STORAGE_KEYS } from "@/shared/config/app-config";
import type { KeyValueStore } from "@/shared/lib/storage/key-value-store";
import { migrateFromV1, normalizeStoredLibrary } from "./library-migrations";
import type { StoredLibrary } from "./types";
import { VideoLibrary } from "./video-library";
import type { VideoCatalog } from "./video-catalog";

/** Reads and writes the library, hiding both the storage key and migrations. */
export class LibraryRepository {
  constructor(
    private readonly store: KeyValueStore,
    private readonly catalog: VideoCatalog,
    private readonly key: string = STORAGE_KEYS.library,
    private readonly legacyKey: string = STORAGE_KEYS.legacyLibrary,
  ) {}

  load(): VideoLibrary {
    const current = this.loadCurrent();
    if (current) {
      // Already on the new key: nothing left to migrate.
      this.store.remove(this.legacyKey);
      return current;
    }

    const migrated = this.loadLegacy();
    if (migrated) {
      this.save(migrated);
      this.store.remove(this.legacyKey);
      return migrated;
    }

    return VideoLibrary.default(this.catalog);
  }

  /** Accepts external payloads (transfer codes) through the same migrations. */
  adopt(library: StoredLibrary): VideoLibrary {
    return VideoLibrary.from(
      this.catalog,
      normalizeStoredLibrary(this.catalog, library),
    );
  }

  save(library: VideoLibrary) {
    this.store.write(this.key, JSON.stringify(library.toJSON()));
  }

  private loadCurrent(): VideoLibrary | null {
    const raw = this.store.read(this.key);
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as StoredLibrary;
      return VideoLibrary.from(
        this.catalog,
        normalizeStoredLibrary(this.catalog, parsed),
      );
    } catch {
      this.store.remove(this.key);
      return null;
    }
  }

  /** One-time read of the retired `kidtube-library-v1` payload. */
  private loadLegacy(): VideoLibrary | null {
    const raw = this.store.read(this.legacyKey);
    if (!raw) {
      return null;
    }

    try {
      return VideoLibrary.from(
        this.catalog,
        migrateFromV1(this.catalog, JSON.parse(raw)),
      );
    } catch {
      this.store.remove(this.legacyKey);
      return null;
    }
  }
}
