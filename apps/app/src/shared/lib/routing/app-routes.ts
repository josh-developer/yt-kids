import { routing } from "@repo/internationalization/routing";
import type { AppLocale } from "@repo/internationalization/routing";

export type AppRoute =
  | { view: "home"; query: string }
  | { view: "settings" }
  | { view: "watch"; videoId: string };

export type AppView = AppRoute["view"];

export const HOME_ROUTE: AppRoute = { view: "home", query: "" };

function decodeSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function isAppLocale(value: string): value is AppLocale {
  return (routing.locales as readonly string[]).includes(value);
}

/**
 * Splits `/uz/watch/abc` into its locale and the locale-free rest, so route
 * matching stays in terms of plain `/watch/:id` shapes.
 */
export function splitLocalePath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  const [maybeLocale, ...rest] = segments;

  if (maybeLocale && isAppLocale(maybeLocale)) {
    return { locale: maybeLocale, path: `/${rest.join("/")}` };
  }

  return { locale: routing.defaultLocale, path: `/${segments.join("/")}` };
}

export function routeFromPath(pathname: string, search: string): AppRoute {
  const { path } = splitLocalePath(pathname);
  const normalized = path.replace(/\/+$/, "") || "/";
  const params = new URLSearchParams(search);

  if (normalized === "/settings") {
    return { view: "settings" };
  }

  const watchMatch = normalized.match(/^\/watch\/([^/]+)$/);
  if (watchMatch) {
    return { view: "watch", videoId: decodeSegment(watchMatch[1]) };
  }

  return { view: "home", query: params.get("q") ?? "" };
}

export function routeFromLocation(fallback: AppRoute = HOME_ROUTE): AppRoute {
  if (typeof window === "undefined") {
    return fallback;
  }

  return routeFromPath(window.location.pathname, window.location.search);
}

export function pathForRoute(route: AppRoute, locale: string) {
  const base = `/${locale}`;

  if (route.view === "settings") {
    return `${base}/settings`;
  }

  if (route.view === "watch") {
    return `${base}/watch/${encodeURIComponent(route.videoId)}`;
  }

  const query = route.query.trim();
  if (!query) {
    return base;
  }

  return `${base}?${new URLSearchParams({ q: query }).toString()}`;
}
