# Desktop CI pipelines — design

- **Date:** 2026-09-26
- **Status:** draft, for review
- **Applies the hub playbook:**
  [release-gated-verification](https://github.com/csdev19/general-knowledge/blob/main/monorepos/release-gated-verification.md),
  [ci-runner-cost](https://github.com/csdev19/general-knowledge/blob/main/monorepos/ci-runner-cost.md),
  [actions-cache-lifecycle](https://github.com/csdev19/general-knowledge/blob/main/monorepos/actions-cache-lifecycle.md),
  [native-dependencies](https://github.com/csdev19/general-knowledge/blob/main/desktop/native-dependencies.md)
- **Decision record:** ADR 0003 (written with the implementation)

## Goal

Stop the template — and every repository generated from it — from growing the CI cost and cache
problems that kaipu and invisible-assistant had to fix after the fact. Scope, chosen by the
product owner: the desktop pipelines plus the shared base they depend on. `pr-validation.yml`
stays a per-PR check; moving web and server to the full release-candidate model is a later pass.

## Baseline (PR #25, 2026-09-26)

| Workflow              | Runner | Install deps | Everything else                | Result                   |
| --------------------- | ------ | ------------ | ------------------------------ | ------------------------ |
| PR Validation         | Linux  | 2 m 04 s     | ~1 m 36 s (tests 5 s)          | success                  |
| Desktop CI (Electron) | Linux  | 2 m 01 s     | 7 s (tests 2 s, build 5 s)     | success                  |
| Desktop CI (Tauri)    | Linux  | **3 m 19 s** | 33 s apt, then clippy 1 m 20 s | **failure, after merge** |
| Customizer Test       | Linux  | —            | 55 s, 8 jobs                   | success                  |

Cache after one PR: **578 MB** of bun install cache left on `refs/pull/25/merge`.

Local `verify` (lint, format check, package builds, type-check, tests) on the owner's machine:
**10 s cold, 3 s warm**. Tauri's Rust checks (clippy + tests): **7 s warm**.

## Findings

1. **Root `postinstall` runs `install-electron && electron-builder install-app-deps`** on every
   `bun install`, in every workflow — Tauri's included. It is why install dominates every job.
   The hub rule is "no `postinstall` anywhere". The Electron app has **no native modules**
   (`node:sqlite`), so `install-app-deps` does nothing useful; only the Electron binary download
   is needed, and only by `dev`, packaging and release.
2. **Neither `release-desktop-*.yml` has a `verify` job** in front of signing and publishing
   (rule R1, non-negotiable).
3. **No root `verify` script**; `pre-push` runs lint and format only (R2, R4).
4. **Both desktop CIs run on every PR** that touches `packages/**` or `bun.lock`. Measured
   against a 3 s warm local `verify`, PR-time cloud runs buy a status icon for a single owner.
5. **No `cache-cleanup.yml`**, so every PR's caches outlive it; Rust `target/` would add hundreds
   of MB per PR on top of bun's 578 MB.
6. **No turbo cache**; only Electron CI caches bun.
7. **Workflow headers state no tier and no reopen condition** (R5).
8. **A real bug reached `main`:** `RunEvent` is imported unconditionally but only used under
   `cfg(target_os = "macos")`, so clippy fails on Linux. The PR merged before the check finished —
   the check was advisory, which is exactly the "status icon" the playbook describes.

## Design

### 1. No lifecycle scripts

- Delete the root `postinstall`, and the Electron app's `postinstall`.
- Electron app: `electron:install` runs `install-electron` (idempotent — exits at once when the
  binary is present). `dev`, `start`, `package:*` and the release workflow call it first.
- `electron-builder.yml`: `npmRebuild: false`. The README states the rule for adding a native
  module later: an explicit `rebuild:native`, per the hub.
- `customize.ts` no longer carries `postinstall` in `DESKTOP_APPS.electron.scripts`.

### 2. One definition of verified

- Root `verify`: `lint && oxfmt --check . && build packages && check-types && test`.
- `apps/desktop-tauri`: `verify:rust` = `cargo fmt --check && clippy -D warnings && cargo test`
  plus the stale-bindings check (a small script, so hook and CI run the same thing).
- `lefthook.yml` pre-push: `bun run verify` always; `verify:rust` only when the push touches
  `apps/desktop-tauri/src-tauri/**` or `packages/i18n/messages/**` (the tray embeds them).
  `customize.ts` removes that job when Tauri is dropped.

### 3. Release gates (R1)

Both `release-desktop-*.yml` gain a Linux `verify` job on the tagged SHA; the macOS job
`needs: verify`. Tauri's gate also runs `verify:rust` (apt WebKitGTK packages + `rust-cache` in
restore-only mode). Electron's macOS job calls `electron:install` before packaging.

### 4. Desktop CI off the PR path

`ci-desktop-electron.yml` and `ci-desktop-tauri.yml` become `workflow_dispatch` only — the
"candidate on demand" tier — with a header naming the tier and what reopens it: a second person
merging, or release gates catching what the pre-push missed. They keep running the same commands
as the release gate, so a dispatch is a faithful rehearsal.

### 5. Cache

- bun install cache keyed on `bun.lock`; turbo cache on `.turbo` keyed on
  `bun.lock` + `turbo.json`. Never `github.sha`.
- `rust-cache` saves only on `main` and tags (`save-if`), restores everywhere else — a PR never
  mints a Rust entry.
- `cache-cleanup.yml` on `pull_request: closed` deletes that PR's caches by id, filtered on
  `refs/pull/<n>/merge`.
- `customize.ts`' generated `pr-validation.yml` gets the bun and turbo caches too.

### 6. Headers

Every workflow names its tier, what it costs, and the condition that would move it.

### 7. Fix the Linux clippy failure

Gate the import on macOS (or use the fully qualified path) and prove it with a Linux run: a manual
dispatch of `ci-desktop-tauri.yml` on the branch.

## Verification

- The baseline above versus a dispatch of each desktop CI and a customizer run on this branch:
  install time, total time, cache entries created.
- `bun install` produces no Electron download; `bun run dev:desktop-electron` still starts.
- `customize` for every desktop combination: no dangling scripts or hook jobs, generated CI valid.
- `grep -L "needs:" .github/workflows/release-*.yml` prints nothing.

## Not in scope

- `pr-validation.yml` becoming dispatch + release-candidate, and release-please (kaipu's full
  ADR 0004 model).
- Web and server workflows beyond the shared caches.
- Budget and spending-limit settings (R3): an account setting, flagged to the owner, not code.
