export {
  DEFAULT_LOCALE,
  isAppLocale,
  LOCALES,
  MESSAGES,
  otherLocale,
  type AppLocale,
} from "@repo/messages";

/**
 * Re-exported rather than redefined.
 *
 * The strings, the locale list and the default all come from `@repo/messages`, the
 * same package the website reads — so a correction on one side is a correction on
 * both, and the two cannot disagree about which locales exist.
 *
 * Deliberately *not* `@repo/internationalization`: that package owns the web's
 * `next-intl` machinery, and `next-intl` brings its own copy of React. A second
 * React reachable from a React Native bundle is how hooks end up reading a null
 * dispatcher, and `expo-doctor` flags it for exactly that reason.
 *
 * Metro inlines the catalogs into the bundle, which is what we want: the UI language
 * has to be available before the first frame, and a phone with no connection still
 * has to render.
 */
