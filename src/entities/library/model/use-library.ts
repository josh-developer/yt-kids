import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserStore } from "@/shared/lib/storage/key-value-store";
import { TimerBag } from "@/shared/lib/timers";
import { LibraryRepository } from "./library-repository";
import { CATALOG } from "./video-catalog";
import { VideoLibrary } from "./video-library";

/** Edits arrive in bursts; one write after the burst is enough. */
const SAVE_DEBOUNCE_MS = 400;

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
  const saveTimers = useRef(new TimerBag());
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

    // Serialising the whole library is synchronous work on the main thread,
    // and edits arrive in bursts — approve-all, or a duration per video as an
    // import resolves. One write after the burst says the same thing.
    const timers = saveTimers.current;
    timers.timeout("save", () => repository.save(library), SAVE_DEBOUNCE_MS);

    return () => {
      timers.clear("save");
      // The last state still has to reach storage if we are going away.
      repository.save(library);
    };
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
