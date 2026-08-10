# KidTube

A parent-curated YouTube-style React app for kids.

Parents approve videos in the settings screen. Approved videos appear on the
home feed in a YouTube-like grid, and each watch page recommends only other
approved videos.

## Prerequisites

- Node.js `>=22.13.0`
- pnpm `>=10`

## Quick Start

```bash
pnpm install
pnpm dev
pnpm build
```

## Monorepo Layout

The repository is a [Turborepo](https://turborepo.com) monorepo structured
after [next-forge](https://www.next-forge.com):

```text
apps/
  app/                        the KidTube app (vinext + Cloudflare Workers)
packages/
  internationalization/       next-intl routing/request config + message catalogs
  next-config/                shared Next.js config consumed by next.config.ts
  seo/                        createMetadata defaults and JSON-LD helper
  typescript-config/          shared tsconfig presets (base, nextjs, react-library)
```

Root scripts fan out through turbo: `pnpm build`, `pnpm test`, `pnpm lint`,
`pnpm typecheck`, `pnpm dev`. Run a single workspace with
`pnpm --filter app <script>`.

## Architecture

The app follows [Feature-Sliced Design](https://feature-sliced.design). Layers
may only import downwards, and only through a slice's `index.ts`:

```text
apps/app/app/            Next.js routes = FSD app layer (_shell, _providers, api)
apps/app/src/pages/      one composition per view: home, watch, settings
apps/app/src/widgets/    self-contained blocks: top-bar, player, settings-panel, ...
apps/app/src/features/   user actions: video-import, library-transfer, theme-toggle, ...
apps/app/src/entities/   domain objects: video, library, watch-history
apps/app/src/shared/     config, lib, api, ui with no knowledge of the domain
```

`eslint-plugin-boundaries` enforces the direction — importing `@/features/*`
from `src/shared` fails `pnpm lint`.

Logic lives in plain classes; React components stay thin and call into them:

| Class | Responsibility |
| --- | --- |
| `VideoLibrary` | Immutable library value: approve, hide, remove, playlists |
| `LibraryRepository` | Load/save/migrate through a `KeyValueStore` |
| `VideoCatalog` | Shipped catalog plus the id <-> number map for transfer codes |
| `WatchStack` | Trail of watched videos behind previous/next |
| `EncryptedTransferCodec` | Library <-> shareable code (gzip + AES-GCM) |
| `VideoImporter` | Pasted link -> videos, over the `YouTubeApi` interface |
| `PlayerController` | The YouTube postMessage protocol |
| `FullscreenController` | Native / CSS fullscreen and orientation |
| `TimerBag` | Named timers with one cancel point |

Dependencies are taken as interfaces (`KeyValueStore`, `YouTubeApi`,
`LibraryTransferCodec`), so each class can be exercised without a browser or
the network.

## Storage

The approved library is stored in browser `localStorage` under
`kidtube-library-v1`, reached only through `LibraryRepository`. This keeps the first version simple and private to the
device. Use a backend database later if approvals need to sync across devices.

## Localization

Copy lives in `packages/internationalization/messages/<locale>.json` and is
rendered with [next-intl](https://next-intl.dev). Locales are part of the URL
(`/en/watch/:id`, `/uz/watch/:id`); `apps/app/proxy.ts` negotiates a locale for
locale-less URLs from the `NEXT_LOCALE` cookie, then `Accept-Language`, and the
language button navigates between prefixes.

Adding a locale means: add it to
`packages/internationalization/routing.ts`, add
`packages/internationalization/messages/<locale>.json`, and add its shell
paths to `APP_SHELL` in `apps/app/public/sw.js`.

Two notes for contributors:

- `next-intl`'s Next.js plugin only wires its request config through
  webpack/turbopack. This app runs on vinext (Vite), so
  `apps/app/vite.config.ts` aliases `next-intl/config` to
  `packages/internationalization/request.ts` by hand.
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

- `pnpm dev`: start local development
- `pnpm build`: verify the production build
- `pnpm lint`: run lint checks
- `pnpm test`: build and verify rendered app output
- `pnpm typecheck`: TypeScript with no emit
