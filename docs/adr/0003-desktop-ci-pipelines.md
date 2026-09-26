# ADR 0003 — Verify locally, gate releases, run nothing per pull request

- **Status:** accepted
- **Date:** 2026-09-26
- **Applies to:** `.github/workflows/`, `lefthook.yml`, root `package.json`, `scripts/customize.ts`
- **Design:** [docs/specs/2026-09-26-desktop-ci-pipelines-design.md](../specs/2026-09-26-desktop-ci-pipelines-design.md)
- **Applies the hub playbook:**
  [release-gated-verification](https://github.com/csdev19/general-knowledge/blob/main/monorepos/release-gated-verification.md),
  [ci-runner-cost](https://github.com/csdev19/general-knowledge/blob/main/monorepos/ci-runner-cost.md),
  [actions-cache-lifecycle](https://github.com/csdev19/general-knowledge/blob/main/monorepos/actions-cache-lifecycle.md),
  [native-dependencies](https://github.com/csdev19/general-knowledge/blob/main/desktop/native-dependencies.md)

## Context

kaipu and invisible-assistant each had to cut their Actions usage after the fact: per-PR cloud
checks on every push, releases that published with no verification job, caches filling the
10 GB budget. The template reproduced the same shape in every repository it generates. PR #25
showed it directly: its Tauri check failed clippy on Linux, and the PR merged before the check
finished — a per-PR check on a single-owner repository with no branch protection is a
notification, not a gate.

Measured on this repository (2026-09-26):

| Item                                              | Value                            |
| ------------------------------------------------- | -------------------------------- |
| Local `verify`, owner's machine                   | 10 s cold, 3 s warm              |
| Tauri `verify:rust` (fmt, clippy, tests), local   | 7 s warm                         |
| Any Linux job: `bun install` of the workspace     | 113–135 s, bun cache hit or miss |
| Root `postinstall` (Electron) inside that install | 1.75 s                           |
| Electron job: tests + build                       | 2 s + 5 s                        |
| Tauri job: `verify:rust`, cold Rust cache         | 3 m 19 s                         |
| bun cache left by one PR                          | 578 MB                           |

The install cost is the size of the workspace (4 492 packages on Linux: web, Expo, docs,
desktop), not the `postinstall` — an earlier draft of the design had that backwards.

## Decision

1. **One definition of green.** Root `verify` = lint, format check, package builds, type-check,
   tests. The Lefthook pre-push runs it. The Tauri app adds `verify:rust` (fmt, clippy
   `-D warnings`, `cargo test`, stale-bindings check), which the pre-push runs only when a push
   touches `apps/desktop-tauri/src-tauri/` or the i18n catalogs its tray embeds.
2. **Nothing runs on pull requests.** PR Validation, Customizer Test, PR Integration and both
   desktop CIs are `workflow_dispatch` only — for rehearsing a risky change (lockfile, workflows,
   `scripts/`, build config) in a clean environment. `customize.ts` generates the same.
3. **Every release is gated (R1).** Both `release-desktop-*.yml` start with a Linux `verify` job
   — the tag/version check, `verify`, and for Tauri `verify:rust` — that the macOS jobs `needs:`.
   A red gate spends no macOS minute and publishes nothing.
4. **No lifecycle scripts.** No `postinstall` anywhere. The Electron app fetches its binary
   through an idempotent `electron:install` that `dev`, `start`, `package:*` and the release call.
   This is the hub's rule (determinism, supply-chain shape), not a time saving.
5. **Caches:** keyed on inputs, never `github.sha`. Release (tag) jobs restore and never save —
   nothing can read a tag's cache. The Rust cache is saved only from `main`; one dispatch of
   `ci-desktop-tauri.yml` on `main` after a `Cargo.lock` change warms it for the release gate.
6. **Every workflow header** names its tier and what would reopen it.

## Alternatives rejected

- **Keep per-PR checks, but cache and path-filter them.** Cheaper per run, still paid on every
  push, and still advisory without branch protection. The pre-push already runs the same
  commands in 3 s.
- **Filtered installs (`bun install --filter <app>`) in the desktop jobs.** A real lever on the
  2-minute install, but only worth it for jobs that run often. None do now.
- **A `cache-cleanup.yml` on PR close** (as in kaipu and invisible-assistant). With no workflow
  running on pull requests there is no PR cache to clean, and it would bill a minute per close.

## Consequences

- A broken push is caught by the owner's hook, not by the cloud. `LEFTHOOK=0` bypasses it; the
  release gate is the backstop, and it runs on the exact SHA that ships.
- Linux-only failures (e.g. `cfg(target_os)` code) are not seen until a release or a dispatch.
  The Tauri README says to dispatch `ci-desktop-tauri.yml` after macOS-only Rust changes.
- A cold release gate pays the full install (~2 min Linux) — cheap next to the macOS job.
- `deploy-production.yml` (web/server) is still not gated by `verify`; recorded below.

## Not done here

- `deploy-production.yml` gated by `verify`, and release-please with a release-candidate check
  (the rest of kaipu's ADR 0004 model) — the web/server pass.
- The account's Actions spending limit and usage alerts (R3): a GitHub setting, not code.

## What would reopen this

- **A second person merges to `main`, or branch protection becomes available:** bring `verify`
  back as one required PR check.
- **A release gate catches something the pre-push missed:** the hook is not enough on its own;
  add a per-PR `verify`.
- **Releases become frequent:** filtered installs and a warm cache start paying for themselves.
