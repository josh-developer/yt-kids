import { useEffect, useRef, useState } from "react";
import { pathForRoute, routeFromLocation, type AppRoute } from "./app-routes";

type NavigationMode = "push" | "replace";

/**
 * Client-side routing inside one locale segment.
 *
 * Views are swapped with `history.pushState` rather than a server navigation,
 * so switching between home, watch and settings never reloads the player or
 * loses in-memory state. The server still renders the correct first view from
 * the real URL.
 */
export function useAppRoute({
  initialRoute,
  locale,
  onExternalRoute,
}: {
  initialRoute: AppRoute;
  locale: string;
  /** Fired for routes the app did not initiate: first paint and back/forward. */
  onExternalRoute?: (route: AppRoute) => void;
}) {
  const [route, setRoute] = useState<AppRoute>(initialRoute);
  const onExternalRouteRef = useRef(onExternalRoute);

  useEffect(() => {
    onExternalRouteRef.current = onExternalRoute;
  });

  useEffect(() => {
    // The server rendered `initialRoute`; re-read the URL once mounted in case
    // the browser is deeper in the app (restored tab, back/forward cache).
    const frame = window.requestAnimationFrame(() => {
      const current = routeFromLocation(initialRoute);
      setRoute(current);
      onExternalRouteRef.current?.(current);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [initialRoute]);

  useEffect(() => {
    function handlePopState() {
      const next = routeFromLocation(initialRoute);
      setRoute(next);
      onExternalRouteRef.current?.(next);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [initialRoute]);

  function navigate(next: AppRoute, mode: NavigationMode = "push") {
    setRoute(next);

    const nextPath = pathForRoute(next, locale);
    if (window.location.pathname + window.location.search !== nextPath) {
      window.history[mode === "replace" ? "replaceState" : "pushState"](
        null,
        "",
        nextPath,
      );
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return { route, navigate };
}
