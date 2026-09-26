---
name: extending-the-template
description: Use when adding, renaming or removing an app or package in this monorepo template — a new pattern, an optional add-on (like mobile, docs or a desktop runtime), a shared package, or a workflow for one of them. Also use when changing which patterns keep an existing app or package.
---

# Extending the template

## Overview

This repo is a template: `bun run customize` deletes what a generated project does not need, so
every app or package has consequences in the customizer, its tests, CI and docs, not only in its
own folder. It also links to the general-knowledge hub instead of carrying reusable knowledge, so
part of the work usually lands there.

Decisions this procedure applies: [ADR 0001](../../../docs/adr/0001-desktop-app.md) and
[ADR 0002](../../../docs/adr/0002-desktop-tauri-alongside-electron.md) (how an add-on is wired),
[ADR 0003](../../../docs/adr/0003-desktop-ci-pipelines.md) (where checks run).

## Step 1 — the workspace itself

- **Names:** apps are unscoped (`"name": "<folder>"`); packages are `@monorepo-template/<folder>`.
  Shared versions come from the root catalog (`"catalog:"`); workspace deps are `"workspace:*"`.
- **tsconfig:** extending `packages/config` ties the app to it. Check `PATTERNS[*].remove` in
  `scripts/customize.ts`: if any pattern that keeps the app removes `packages/config`, make the
  tsconfig self-contained (as `apps/desktop-tauri` does).
- **React apps consuming workspace packages:** `resolve.dedupe: ["react", "react-dom"]` in the
  Vite and Vitest configs.
- **No lifecycle scripts.** No `postinstall`; a binary or native rebuild gets an explicit script
  that the paths needing it call.
- **Scripts:** `build`, `check-types` and `test` exist, so the root `verify` covers the app.
  A non-TypeScript toolchain gets its own `verify:<x>` script (see `apps/desktop-tauri`).
- **Generated output** (`dist/`, `target/`, generated code): in `.gitignore`, and in the
  `ignorePatterns` of `.oxlintrc.json` and `.oxfmtrc.json`.

## Step 2 — root wiring

- `package.json`: `dev:<app>` / `test:<app>` (plus e.g. `bundle:<app>`), and any new catalog entry.
- `lefthook.yml`: a `verify:<x>` job goes in `pre-push` with a `glob` on the app's own sources,
  inside `# >>> <marker>` / `# <<< <marker>` lines so the customizer can remove it.

## Step 3 — the customizer (`scripts/customize.ts`)

| The thing is                                | Wire it through                                                                                                                                                                                                 |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| part of some patterns                       | `PATTERNS[*].keep` / `remove`, and `scriptsRemove` / `catalogRemove`                                                                                                                                            |
| an optional add-on on its own               | the `keepDocs` shape: a `--x` / `--no-x` flag in `parseArgs` + `HELP`, a yes/no prompt in `choicesInteractive`, a boolean in `Choices`, and a delete of its dir, scripts, workflows and hook block when dropped |
| one of a set of mutually exclusive variants | a table like `DESKTOP_APPS` (dir, label, scripts, workflows, hook marker) and a `--x=<variant>` flag; every variant not chosen is deleted                                                                       |
| a package some patterns never use           | `UNUSED_PACKAGES` or a pattern's `unusedPackages`, and `survivingUnusedPackages` if an add-on rescues it                                                                                                        |
| a package                                   | a line in `PACKAGE_PURPOSE` (it feeds the generated architecture doc)                                                                                                                                           |
| a pattern that varies by a choice           | `resolvePatternConfig`                                                                                                                                                                                          |

A kept add-on's catalog entries are protected automatically (`catalogRefs`).

## Step 4 — the customizer's tests

- `scripts/customize.test.ts`: add the app to `ALL_APPS`, and cases that keep and drop it. The
  expectations are hardcoded on purpose — an independent oracle, never derived from `PATTERNS`.
- `.github/workflows/customizer-test.yml`: when the new app or package has its own `build` or
  `check-types`, add one matrix entry that keeps it — otherwise no dispatch ever builds it
  through a real customization.
- The structural tests copy **tracked** files only: `git add` new files before running them.

## Step 5 — workflows (ADR 0003)

- Nothing triggers on `pull_request`. A CI workflow for the app is `workflow_dispatch` only.
- A release workflow triggers on a `<app>-v*.*.*` tag. Its first job runs on Linux: the
  tag/version check and `bun run verify` (plus the app's `verify:<x>`). Every build, sign or
  publish job has `needs: verify`.
- Build on Linux whenever the toolchain can cross-compile; a macOS runner costs ~10x, Windows
  ~1.7x. Use them only for what must be built or signed there.
- Cache keys hash inputs (`bun.lock`, `Cargo.lock`), never `github.sha`. Tag jobs restore
  caches and never save them.
- The header names the tier and the condition that would move it.

## Step 6 — docs

- The app's own `README.md`.
- Root `README.md`: the patterns table, the repository tree, the scripts list, and — for a new
  stack — a row in the stack-recipe table linking its hub recipe.
- `CLAUDE.md`: import rules and any sharp gotcha.
- `.claude/skills/customize-template/SKILL.md`: its apps, packages and patterns tables.
- An ADR in `docs/adr/` (context, decision, alternatives rejected, consequences, non-goals,
  reopen condition) when the change introduces a choice a later reader will ask "why" about: a
  new runtime or framework, a new distribution channel, a new pattern, or a departure from an
  existing ADR. Following an existing ADR's rules needs none — cite it instead. A design gets a
  spec in `docs/specs/`.
- Everything in English.

## Step 7 — the hub

Reusable, product-agnostic knowledge goes to general-knowledge, not into this repo's docs; this
repo links it. That covers:

- a new kind of app — one with no recipe in the hub's `stacks/README.md` table (check the
  table, not memory): a recipe there, and a row in this repo's stack-recipe table linking it;
- any lesson the work produced that other projects will hit.

**REQUIRED SUB-SKILL:** use `cs-update-knowledge-hub` for every hub change, and before renaming
or moving any hub page this repo links to.

## Step 8 — verify

```bash
bun run verify                          # lint, format, package builds, types, tests
bun test scripts/customize.test.ts      # after `git add`
actionlint .github/workflows/*.yml
```

Then run the customizer for real on a copy of the tracked files, for each pattern and add-on
combination the change touches (`bun scripts/customize.ts --pattern <p> [flags] --name t --yes`),
and run the app itself (`bun run dev:<app>`).

## Common mistakes

| Mistake                                                               | Fix                                                                   |
| --------------------------------------------------------------------- | --------------------------------------------------------------------- |
| App extends `packages/config`, a pattern that keeps it deletes config | Self-contained tsconfig (Step 1)                                      |
| Add-on dropped, its scripts or hook job left behind                   | Everything the add-on owns is listed in its table and deleted with it |
| Test expectations computed from `PATTERNS`                            | Hardcode them                                                         |
| Release matrix on macOS/Windows for a cross-compilable binary         | Build on Linux                                                        |
| A `pull_request` trigger "just for this app"                          | `workflow_dispatch`; the pre-push runs `verify`                       |
| Reusable lesson written into this repo's docs                         | Hub page via `cs-update-knowledge-hub`, linked from here              |
