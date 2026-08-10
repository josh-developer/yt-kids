---
root: false
targets: ["*"]
description: "next-intl localization rules: message catalogs, locale URLs, and the vinext-specific wiring"
globs:
  [
    "packages/internationalization/**/*",
    "apps/app/app/**/*.tsx",
    "apps/app/proxy.ts",
    "apps/app/public/sw.js",
  ]
---

# Localization

- Copy lives in `packages/internationalization/messages/<locale>.json`
  (en, uz), rendered with next-intl. Keep the catalogs **key-identical** — a
  test fails on any drift. Never hardcode user-facing strings in components.
- Locales are part of the URL (`/en/watch/:id`, `/uz/watch/:id`).
  `apps/app/proxy.ts` re-exports the middleware from
  `@repo/internationalization/proxy` and owns the matcher.
- Adding a locale: add it to `packages/internationalization/routing.ts`, add
  `messages/<locale>.json`, and add its shell paths to `APP_SHELL` in
  `apps/app/public/sw.js`.
- vinext runs on Vite, so next-intl's webpack plugin does not apply:
  `apps/app/vite.config.ts` aliases `next-intl/config` to
  `packages/internationalization/request.ts` by hand. Keep that alias intact.
- Format numbers from `Format.*` message values, not `Intl.NumberFormat` —
  the Cloudflare Workers runtime ships English-only ICU data, so runtime
  formatting would disagree between server and browser and break hydration.
- Titles are owned by the message catalog (e.g. `"{page} | KidTube"`), and
  `@repo/seo`'s `createMetadata` passes titles through unchanged — don't add
  an app-name suffix in code.
