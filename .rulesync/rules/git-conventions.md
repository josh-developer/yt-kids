---
root: false
targets: ["*"]
description: "Branch naming, commit message, and PR conventions for this repository"
globs: ["**/*"]
---

# Git conventions

- Base branch is `main`. Branch names:
  `feat/<short-topic>`, `fix/<short-topic>`, `perf/<short-topic>`,
  `docs/<short-topic>`, `test/<short-topic>`, `chore/<short-topic>`.
- Commits follow Conventional Commits with a scope, imperative and lowercase,
  matching existing history — e.g.
  `fix(player): carry mute in the embed URL so iOS Safari can unmute`,
  `perf(images): serve YouTube thumbnails from our own origin`.
- Never add AI/assistant attribution anywhere: no `Co-authored-by` trailers
  for AI tools, no "Generated with ..." footers in commits, PR titles, PR
  bodies, or code comments. Strip any that tooling adds by default.
- Before a PR: run `pnpm build`, `pnpm typecheck`, `pnpm lint`, `pnpm test`
  from the root and report honestly which ran. There is no CI yet — local
  validation is the only evidence reviewers get.
- Rule and skill sources live in `.rulesync/`; regenerate tool configs with
  `pnpm rules:generate` instead of editing generated files (CLAUDE.md,
  AGENTS.md, GEMINI.md, `.cursor/rules/`, `.github/instructions/`,
  `.claude/skills/`) by hand.
