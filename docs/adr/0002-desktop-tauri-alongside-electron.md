# ADR 0002 — A Tauri desktop app alongside Electron

- **Status:** accepted
- **Date:** 2026-09-26
- **Applies to:** `apps/desktop-tauri/`, `apps/desktop-electron/`, `scripts/customize.ts`,
  `.github/workflows/*-desktop-*.yml`
- **Design:** [docs/specs/2026-09-26-desktop-tauri-design.md](../specs/2026-09-26-desktop-tauri-design.md)
- **Reusable guidance:** [desktop/tauri-architecture.md](https://github.com/csdev19/general-knowledge/blob/main/desktop/tauri-architecture.md)
  and [desktop/electron-vs-tauri.md](https://github.com/csdev19/general-knowledge/blob/main/desktop/electron-vs-tauri.md)
  in the knowledge hub

## Context

[ADR 0001](./0001-desktop-app.md) added a local-first Electron app. A product generated from this
template (Rimi) then chose Tauri 2 for its desktop client — smaller installers, lower idle memory,
the system webview — and built its scaffold from scratch, because the template offered nothing to
start from. The product owner wants that flow in the template: generate a project and get a
working Tauri app, at the same level of completeness as the Electron one.

Electron stays: it is the better fit for Chromium-dependent or media-heavy apps (see the hub ADR),
and existing users depend on it. So this is a second runtime, not a replacement.

The constraint that shapes the design: Tauri's privileged side is Rust, so the TypeScript use
cases in `@monorepo-template/application` cannot run where Electron runs them (the main process).

## Decision

1. **Two apps, one chosen at customization.** `apps/desktop` becomes `apps/desktop-electron`,
   unchanged. `apps/desktop-tauri` is new. `customize` takes `--desktop=electron|tauri` (a bare
   `--desktop` still means Electron) and keeps at most one; `desktop-local-first` takes its runtime
   from the same flag, defaulting to Electron.
2. **Hybrid architecture (use cases in TS, storage in Rust).** The use cases run in the webview,
   unchanged, over `TauriTodoRepository` — the third adapter of `ITodoRepository`. Each adapter
   method is one Rust command with fixed, parameterized SQL (rusqlite, bundled SQLite, versioned
   migrations on `PRAGMA user_version`, transactions for read-modify-write). The webview never
   sends SQL.
3. **Typed IPC from Rust signatures.** `tauri-specta` generates `src/bindings.ts`, which is
   committed; CI fails when regenerating it changes the file. tauri-specta has no stable release
   for Tauri 2, so `specta`, `specta-typescript` and `tauri-specta` are pinned with `=`. The
   product owner accepted the release candidate because it is widely used in production Tauri apps.
4. **Feature parity with the Electron app:** settings (locale + theme) owned by the Rust core and
   mirrored in the renderer, a tray menu translated from the same `packages/i18n` catalogs
   (embedded with `include_str!`), close-to-tray, background auto-update in release builds, a CI
   workflow and a signed, notarized macOS release workflow.
5. **Same renderer contract.** The Tauri renderer exposes the same `DesktopApi` shape on
   `window.api` as Electron's preload bridge, so the screens, their CSS Modules and their component
   tests are copies of the Electron ones.
6. **Updates from GitHub Releases.** The release uploads `latest.json` with the signed updater
   bundles; the app's endpoint points at `releases/latest/download/latest.json`. No bucket needed.

## Alternatives rejected

- **SQL from the webview (`@tauri-apps/plugin-sql`).** Arbitrary SQL crosses the trust boundary,
  and the plugin has no transaction API — its pool can split `BEGIN` from the next statement
  ([plugins-workspace#886](https://github.com/tauri-apps/plugins-workspace/issues/886)).
- **Everything in Rust** (the GitButler / Yaak shape). The right call when the core is reused
  outside the webview or the work is heavy. Here it would duplicate the TypeScript domain the
  server, web and Electron apps share, and stop demonstrating the port. It stays the migration
  path: move a use case into a command when it earns it.
- **A Node/Bun sidecar running the use cases.** Literal parity with Electron's main process, but it
  ships a JavaScript runtime and a custom IPC to secure — the costs Tauri is chosen to avoid.
- **Replacing Electron.** Breaks existing users and removes the better option for Chromium-heavy
  apps.
- **`ts-rs` instead of tauri-specta.** Stable, but generates types only; the command wrappers would
  be hand-written and could drift from the Rust signatures.
- **A shared desktop UI package.** Two consumers of near-identical screens; extracting now adds a
  package to the customizer's graph for little gain.
- **Publishing the Tauri update feed to R2 like Electron.** Possible, but tauri-action already
  merges the per-architecture entries into one `latest.json` on the release; mirroring that to a
  bucket adds secrets and a job for no benefit in a template.

## Consequences

- Renames that affect existing template users: `apps/desktop` → `apps/desktop-electron`,
  `dev:desktop`/`test:desktop` → `dev:desktop-electron`/`test:desktop-electron`,
  `ci-desktop.yml`/`release-desktop.yml` → `*-desktop-electron.yml`, tag `desktop-v*` →
  `desktop-electron-v*`.
- Contributors to the Tauri app need a Rust toolchain and the platform webview prerequisites.
  Linux CI installs the WebKitGTK dev packages.
- Domain rules run in the webview. Rust re-checks the title (non-empty, ≤ 500 characters) and
  enforces types and ownership scoping; a compromised webview could bypass other rules, but only
  through the narrow commands and only over the local user's data. Acceptable for a single-user
  local-first app.
- `specta` types `f64` as `number | null`; timestamps cross as epoch-millisecond `f64` and the
  adapter treats `null` as a broken contract. `i64` would have needed `bigint`.
- The updater needs its own signing key (`TAURI_SIGNING_PRIVATE_KEY`), separate from the Apple
  certificate. `createUpdaterArtifacts` is off in `tauri.conf.json` so a local bundle works without
  it; the release workflow turns it on.
- The customizer now protects every catalog entry a kept desktop app references. This also fixes
  Electron as an add-on to the backend-only pattern, which used to lose `vite`.

## Non-goals

- Mobile targets (`tauri android|ios`).
- Windows and Linux release pipelines (sketched, commented out, as for Electron).
- Authentication or sync with `server-hono`.
- A shared desktop UI package.

## What would reopen this

- **tauri-specta ships a stable 2.x** → drop the `=` pins.
- **A second non-TypeScript consumer of the domain** (a Rust CLI, native mobile) → move the core to
  Rust.
- **Integrity rules that must hold against a hostile webview** (multi-user data, licensing) → move
  those rules into the commands.
- **A third desktop consumer of the same screens** → extract a shared desktop UI package.
- **One runtime clearly unused** by projects generated from the template → drop it.
