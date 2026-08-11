/**
 * The site this shell wraps.
 *
 * Overridable so a build can be pointed at a preview deployment or at a dev
 * server on the LAN: Expo inlines any `EXPO_PUBLIC_`-prefixed variable at
 * bundle time, so this is a constant by the time it ships.
 */
export const SITE_URL =
  process.env.EXPO_PUBLIC_SITE_URL ?? "https://kidtube.uz";

function hostOf(url: string) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const siteHost = hostOf(SITE_URL);

/**
 * Whether the shell will follow a top-level navigation to `url`.
 *
 * Derived from {@link SITE_URL} rather than hardcoded, so overriding the site
 * moves the fence with it instead of locking the override out.
 *
 * Anything outside it is refused, not handed to the system browser. The web app
 * spends a lot of effort making the player a closed room — no YouTube chrome,
 * no related grid, no clickable title — and opening the OS browser would undo
 * all of it with one tap. Subframes are exempt; the player is a
 * youtube-nocookie iframe and blocking it would block playback.
 */
export function isAllowedSiteUrl(url: string) {
  const host = hostOf(url);
  if (!host || !siteHost) {
    return false;
  }

  return host === siteHost || host.endsWith(`.${siteHost}`);
}
