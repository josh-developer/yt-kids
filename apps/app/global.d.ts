// Script file (no imports/exports) on purpose: wildcard module declarations
// only apply globally from a non-module .d.ts. Module augmentations that need
// an import live in `augmentations.d.ts`; the next-intl `AppConfig`
// augmentation (typed locales + messages) lives in `@repo/internationalization`.

declare module "*.module.css" {
  const styles: Readonly<Record<string, string>>;
  export default styles;
}

interface CacheStorage {
  /**
   * Cloudflare's shared edge cache. Not part of the DOM Cache API, and not
   * present off Workers — every read of it is guarded at the call site.
   */
  readonly default: Cache;
}
