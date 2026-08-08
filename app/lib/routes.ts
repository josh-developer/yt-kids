import type { AppRoute, WatchStack } from "./types";

export const HOME_ROUTE: AppRoute = { view: "home", query: "" };

export function decodeRouteSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function browserRouteFromLocation(
  fallback: AppRoute = HOME_ROUTE,
): AppRoute {
  if (typeof window === "undefined") {
    return fallback;
  }

  const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
  const params = new URLSearchParams(window.location.search);

  if (pathname === "/settings") {
    return { view: "settings" };
  }

  const watchMatch = pathname.match(/^\/watch\/([^/]+)$/);
  if (watchMatch) {
    return { view: "watch", videoId: decodeRouteSegment(watchMatch[1]) };
  }

  return { view: "home", query: params.get("q") ?? "" };
}

export function pathForRoute(route: AppRoute) {
  if (route.view === "settings") {
    return "/settings";
  }

  if (route.view === "watch") {
    return `/watch/${encodeURIComponent(route.videoId)}`;
  }

  const query = route.query.trim();
  if (!query) {
    return "/";
  }

  const params = new URLSearchParams({ q: query });
  return `/?${params.toString()}`;
}

export function watchStackForRoute(route: AppRoute): WatchStack {
  return route.view === "watch"
    ? { ids: [route.videoId], index: 0 }
    : { ids: [], index: -1 };
}
