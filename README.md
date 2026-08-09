# KidTube

A parent-curated YouTube-style React app for kids.

Parents approve videos in the settings screen. Approved videos appear on the
home feed in a YouTube-like grid, and each watch page recommends only other
approved videos.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

## Localization

Copy lives in `messages/<locale>.json` and is rendered with
[next-intl](https://next-intl.dev). Locales are part of the URL
(`/en/watch/:id`, `/uz/watch/:id`); `proxy.ts` negotiates a locale for
locale-less URLs from the `NEXT_LOCALE` cookie, then `Accept-Language`, and the
language button navigates between prefixes.

Adding a locale means: add it to `src/shared/config/i18n/routing.ts`, add
`messages/<locale>.json`, and add its shell paths to `APP_SHELL` in
`public/sw.js`.

Two notes for contributors:

- `next-intl`'s Next.js plugin only wires its request config through
  webpack/turbopack. This app runs on vinext (Vite), so `vite.config.ts`
  aliases `next-intl/config` to the request config by hand.
- Numbers are formatted from `Format.*` message values, not
  `Intl.NumberFormat`. The Cloudflare Workers runtime ships ICU with English
  data only, so runtime formatting would disagree between server and browser.

## Features

- Curated home feed with approved videos only
- Watch view with embedded YouTube player
- Recommendations limited to approved videos
- Parent settings with searchable curated catalog
- Plus-button import for pasted YouTube links or video IDs
- Responsive layouts for desktop and mobile
- English and Uzbek interface with locale-prefixed URLs

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the production build
- `npm run lint`: run lint checks
- `npm test`: build and verify rendered app output
