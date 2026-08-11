// Script file (no imports/exports) on purpose: wildcard module declarations
// only apply globally from a non-module .d.ts. Module augmentations that need
// an import live in `augmentations.d.ts`; the next-intl `AppConfig`
// augmentation (typed locales + messages) lives in `@repo/internationalization`.

/** Injected by `define` in vite.config.ts. */
declare const __BUILD_TIME__: string;
declare const __APP_ENV__: string;

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
