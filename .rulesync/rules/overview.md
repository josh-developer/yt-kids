---
root: true
targets: ["*"]
description: "KidTube project overview: monorepo layout, commands, and core constraints"
globs: ["**/*"]
---

# KidTube

A parent-curated YouTube-style PWA for kids. Parents approve videos in the
settings screen; the home feed, watch page, and recommendations only ever show
approved videos.

## Monorepo

Turborepo + pnpm monorepo structured after next-forge:

- `apps/app` — the KidTube app: Next.js 16 App Router running on vinext
  (Vite) + Cloudflare Workers. Not stock Next.js: no webpack/turbopack, no
  Vercel. The worker entry is `apps/app/worker/index.ts`.
- `packages/internationalization` — next-intl routing/request/navigation
  config plus `messages/<locale>.json` catalogs (en, uz).
- `packages/next-config` — shared Next.js config consumed by
  `apps/app/next.config.ts`.
- `packages/seo` — `createMetadata` defaults and the `JsonLd` helper.
- `packages/typescript-config` — shared tsconfig presets (`base.json`,
  `nextjs.json`, `react-library.json`).

## Commands

Run from the repo root; turbo fans out and caches:

- `pnpm dev` — local development
- `pnpm build` — production build
- `pnpm typecheck` — TypeScript, no emit
- `pnpm lint` — ESLint (includes FSD boundary checks)
- `pnpm test` — builds, then asserts the worker's rendered HTML per locale
- Scope to one workspace: `pnpm --filter app <script>` or
  `pnpm turbo <task> --filter=@repo/<pkg>`

Node `>=22.13.0`, pnpm `>=10`.

## Core constraints

- No database, no auth, no analytics, no app-level env vars. The library is
  browser `localStorage` (`kidtube-library-v1`), reached only through
  `LibraryRepository`. Don't introduce services or env vars casually.
- Logic lives in plain, framework-free classes (`VideoLibrary`,
  `PlayerController`, `EncryptedTransferCodec`, ...) that take dependencies as
  interfaces; React components stay thin and call into them.
- Styling is CSS Modules plus design tokens in `apps/app/app/globals.css` —
  not Tailwind utility classes.
