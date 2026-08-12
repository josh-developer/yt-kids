import en from "./en.json";
import uz from "./uz.json";

/**
 * The UI strings, and the locales they exist in.
 *
 * A package of its own, separate from `@repo/internationalization`, because two
 * very different clients need it. The web app needs `next-intl` — request configs,
 * navigation helpers, the locale cookie — and the native app needs none of that and
 * must not have it: `next-intl` depends on its own copy of React, and a second React
 * reachable from a React Native bundle is how you get hooks reading a null
 * dispatcher.
 *
 * So the strings live here with no dependencies at all, and each side brings its own
 * machinery. `@repo/internationalization` is that machinery for the web.
 */
export const LOCALES = ["en", "uz"] as const;
export type AppLocale = (typeof LOCALES)[number];

/**
 * Every URL on the web carries its locale, so a shared link opens in the language
 * it was shared in; this is only what `/` falls back to.
 */
export const DEFAULT_LOCALE: AppLocale = "en";

export const MESSAGES = { en, uz } satisfies Record<AppLocale, unknown>;

/** The shape of a catalog, for `next-intl`'s `AppConfig` augmentation. */
export type Messages = typeof en;

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return (
    value !== null &&
    value !== undefined &&
    (LOCALES as readonly string[]).includes(value)
  );
}

/** The locale a two-language switch offers next. */
export function otherLocale(locale: AppLocale): AppLocale {
  return LOCALES.find((candidate) => candidate !== locale) ?? DEFAULT_LOCALE;
}
