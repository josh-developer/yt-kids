---
name: create-a-pr
description: >-
  Open a pull request for KidTube (yt-kids) work. Load before creating the
  branch, commit, or PR, including when opening a PR is the tail step of a task
  that was about something else.
---
# Skill: Create a KidTube PR

Use this when asked to prepare a branch and pull request for a change in this
repository — a Turborepo monorepo (pnpm) with the app in `apps/app` (Next.js
App Router on vinext + Cloudflare Workers) and shared packages in `packages/*`
(`@repo/internationalization`, `@repo/next-config`, `@repo/seo`,
`@repo/typescript-config`).

## Preflight

1. Understand the working tree state:
   ```bash
   git status --short --branch
   git diff --stat
   ```
2. Read `README.md` if you haven't this session — it documents the monorepo
   layout, the Feature-Sliced Design rules, and the localization constraints.
3. Confirm no unrelated local changes are included. The base branch is `main`.

## Branch and commit conventions

- Branch names: `feat/<short-topic>`, `fix/<short-topic>`, `perf/<short-topic>`,
  `docs/<short-topic>`, `test/<short-topic>`, or `chore/<short-topic>`.
- Commit messages follow Conventional Commits with a scope, matching existing
  history, e.g. `fix(player): carry mute in the embed URL so iOS Safari can
  unmute`, `perf(images): serve YouTube thumbnails from our own origin`.
- Keep commits focused; imperative, lowercase summaries.
- Never add AI/assistant attribution to commits, PR titles, or PR bodies — no
  `Co-authored-by: Claude`, no "Generated with" footers. Strip any that tooling
  adds by default.

## Repo-specific hygiene

- **FSD boundaries**: layers import downwards only
  (`app > pages > widgets > features > entities > shared`), through a slice's
  `index.ts`. `eslint-plugin-boundaries` fails `lint` on violations — don't
  "fix" a violation by weakening `apps/app/eslint.config.mjs`.
- **Localization**: copy lives in
  `packages/internationalization/messages/<locale>.json`. Keep `en.json` and
  `uz.json` key-identical — a test enforces it. New routes or locales also need
  their shell paths added to `APP_SHELL` in `apps/app/public/sw.js`.
- **Client boundary**: keep server components thin; client code hangs off the
  `_shell/kids-tube-app.tsx` tree. Don't add `"use client"` to route files.
- **No env vars / no secrets**: the app reads no application env vars; don't
  introduce one casually. Cloudflare bindings live in `apps/app/vite.config.ts`.

## Validation checklist

Run the full pipeline from the repo root (turbo caches unchanged tasks, and
`test` builds first automatically):

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

Scope to one workspace while iterating: `pnpm --filter app lint`,
`pnpm turbo typecheck --filter=@repo/seo`. Targeted runs are acceptable for
small changes, but the PR body must say what was and was not run. `pnpm test`
exercises the built Cloudflare worker's rendered HTML per locale — run it for
any change that touches routes, metadata, messages, or the worker.

## PR body template

```md
## Summary
- ...

## Why
- ...

## Changes
- ...

## Validation
- [ ] `pnpm build`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm test`

## Risk / follow-ups
- ...
```

## Updating an existing PR

The template above is for new pull requests. Before editing an existing PR
body, fetch the current body with `gh pr view --json body` and merge your
changes into it — never replace maintainer-authored or bot-managed text with a
freshly generated template.

## Create the PR with GitHub CLI

Review the final diff immediately before committing:

```bash
git checkout -b <type>/<short-topic>
git status --short
git add <files>
git commit -m "<type>(<scope>): <summary>"
git push -u origin <type>/<short-topic>
gh pr create --base main --title "<type>(<scope>): <summary>" --body-file <file>
```

Write the body to a temp file and pass it with `--body-file`. Do not use
`--fill` — it builds the body from commit messages and drops the template.
There is no CI workflow in this repository yet, so the validation checklist in
the PR body is the only evidence reviewers get: run the pipeline locally
before pushing and tick only what actually ran and passed.

## Final response

Return the PR URL, branch name, commit summary, and validation evidence
(which commands ran, and their results).
