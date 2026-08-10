import { STORAGE_KEYS } from "@/shared/config/app-config";
import type { KeyValueStore } from "@/shared/lib/storage/key-value-store";
import { normalizeStoredLibrary } from "./library-migrations";
import type { StoredLibrary } from "./types";
import { VideoLibrary } from "./video-library";
import type { VideoCatalog } from "./video-catalog";

/** Reads and writes the library, hiding both the storage key and migrations. */
export class LibraryRepository {
  constructor(
    private readonly store: KeyValueStore,
    private readonly catalog: VideoCatalog,
    private readonly key: string = STORAGE_KEYS.library,
  ) {}

  load(): VideoLibrary {
    const raw = this.store.read(this.key);
    if (!raw) {
      return VideoLibrary.default(this.catalog);
    }

    try {
      const parsed = JSON.parse(raw) as StoredLibrary;
      return VideoLibrary.from(
        this.catalog,
        normalizeStoredLibrary(this.catalog, parsed),
      );
    } catch {
      this.store.remove(this.key);
      return VideoLibrary.default(this.catalog);
    }
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
}
