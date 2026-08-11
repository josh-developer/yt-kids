/**
 * Keys for what the app remembers between launches.
 *
 * Named after the web app's `STORAGE_KEYS` so the two are recognisably the same
 * preferences, even though the stores are separate — `localStorage` in a browser,
 * `AsyncStorage` here. Versioned suffixes for the same reason the web has them: a
 * change of shape gets a new key rather than a migration.
 */
export const STORAGE_KEYS = {
  theme: "kidtube-theme-v1",
  locale: "kidtube-locale-v1",
} as const;
