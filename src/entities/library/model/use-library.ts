import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserStore } from "@/shared/lib/storage/key-value-store";
import { LibraryRepository } from "./library-repository";
import { CATALOG } from "./video-catalog";
import { VideoLibrary } from "./video-library";

/**
 * Binds the library to React: the first render uses defaults so the server and
 * the browser agree, then the stored library replaces it after hydration.
 */
export function useLibrary() {
  const repository = useMemo(
    () => new LibraryRepository(createBrowserStore(), CATALOG),
    [],
  );
  const [library, setLibrary] = useState(() => VideoLibrary.default(CATALOG));
  const [isLoaded, setIsLoaded] = useState(false);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // Deferred by a frame so the first paint still matches the server render.
    const frame = window.requestAnimationFrame(() => {
      setLibrary(repository.load());
      hasLoadedRef.current = true;
      setIsLoaded(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [repository]);

  useEffect(() => {
    // Never write the defaults back over a library we have not read yet.
    if (!hasLoadedRef.current) {
      return;
    }

    repository.save(library);
  }, [library, repository]);

  const update = useCallback(
    (mutate: (current: VideoLibrary) => VideoLibrary) => {
      setLibrary((current) => mutate(current));
    },
    [],
  );

  return { library, isLoaded, repository, update, replace: setLibrary };
}

export type LibraryController = ReturnType<typeof useLibrary>;
