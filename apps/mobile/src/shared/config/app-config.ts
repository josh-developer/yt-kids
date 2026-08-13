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
  /**
   * The *hidden* ids, not the approved ones. An empty store then means "nothing
   * hidden", so a fresh install shows the whole catalog and a catalog that grows in a
   * later release needs no migration to make its new videos visible.
   */
  hiddenVideos: "kidtube-hidden-videos-v1",
  /** Whether the watch sheet shows its recommendation list. */
  recommendations: "kidtube-recommendations-v1",
  /** Videos a parent added by URL, which are not in `@repo/catalog`. */
  customVideos: "kidtube-custom-videos-v1",
} as const;
