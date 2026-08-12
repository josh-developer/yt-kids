/**
 * Fills the `Intl` holes Hermes leaves, so an ICU message behaves as it does on the web.
 *
 * Hermes has no `Intl.PluralRules`, and `Settings.approvedCount` is
 * `{count, plural, one {...} other {...}}` — the same catalog entry the web renders
 * through `next-intl`. Without the polyfill `intl-messageformat` throws while
 * rendering, which took the settings screen down with a red box rather than degrading.
 *
 * Each package ships a `shouldPolyfill()` that returns the locale to load, or nothing
 * when the runtime already has a working implementation — so an engine that grows
 * these (Hermes with full ICU, or JSC on iOS) pays only the guard. The locale data has
 * to be required rather than imported: an `import` is hoisted above the guard, and
 * loading data for an absent implementation is exactly what the guard prevents.
 *
 * Only `en` and `uz` are bundled, because those are the only locales `@repo/messages`
 * has. A third locale needs its data added here as well as its catalog added there.
 *
 * The `.js` on every specifier is not optional: these packages publish an `exports`
 * map whose keys carry the extension, and both Metro and TypeScript honour it.
 */

/* eslint-disable @typescript-eslint/no-require-imports -- Guarded, order-sensitive: see above. */
import { shouldPolyfill as shouldPolyfillCanonical } from "@formatjs/intl-getcanonicallocales/should-polyfill.js";
import { shouldPolyfill as shouldPolyfillLocale } from "@formatjs/intl-locale/should-polyfill.js";
import { shouldPolyfill as shouldPolyfillPluralRules } from "@formatjs/intl-pluralrules/should-polyfill.js";

// `Intl.Locale` and `getCanonicalLocales` are what the other polyfills resolve tags
// with, so they go first.
if (shouldPolyfillCanonical()) {
  require("@formatjs/intl-getcanonicallocales/polyfill-force.js");
}

if (shouldPolyfillLocale()) {
  require("@formatjs/intl-locale/polyfill-force.js");
}

if (shouldPolyfillPluralRules()) {
  require("@formatjs/intl-pluralrules/polyfill-force.js");
  require("@formatjs/intl-pluralrules/locale-data/en.js");
  require("@formatjs/intl-pluralrules/locale-data/uz.js");
}
/* eslint-enable @typescript-eslint/no-require-imports */
