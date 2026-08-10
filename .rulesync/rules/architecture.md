---
root: false
targets: ["*"]
description: "Feature-Sliced Design layers and import rules for the app source"
globs: ["apps/app/**/*.ts", "apps/app/**/*.tsx"]
---

# Architecture: Feature-Sliced Design

`apps/app` follows Feature-Sliced Design. Layers import **downwards only**,
and only through a slice's `index.ts`:

```text
apps/app/app/            Next.js routes = FSD app layer (_shell, _providers, api)
apps/app/src/pages/      one composition per view: home, watch, settings
apps/app/src/widgets/    self-contained blocks: top-bar, player, settings-panel, ...
apps/app/src/features/   user actions: video-import, library-transfer, theme-toggle, ...
apps/app/src/entities/   domain objects: video, library, watch-history
apps/app/src/shared/     config, lib, api, ui with no knowledge of the domain
```

- `eslint-plugin-boundaries` enforces the direction; a violation fails
  `pnpm lint`. Never "fix" a violation by weakening
  `apps/app/eslint.config.mjs` — restructure the code instead.
- The `@/*` alias maps to `apps/app/src/*`. Shared monorepo code is imported
  from `@repo/*` packages.
- Client boundary: exactly two `"use client"` files —
  `app/_shell/kids-tube-app.tsx` and `app/_providers/pwa-registrar.tsx`.
  Route files and the layout stay server components; don't add `"use client"`
  to them.
- Domain logic belongs in plain classes under a slice's `model/`, injected via
  interfaces (`KeyValueStore`, `YouTubeApi`, `LibraryTransferCodec`) so it can
  be tested without a browser or the network.
- `src/pages/` is FSD pages, not the Next.js pages router. Routing lives in
  `apps/app/app/` only.
