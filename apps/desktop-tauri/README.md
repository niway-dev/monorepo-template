# desktop-tauri

A local-first Tauri 2 app: everything it stores lives on the device, and it makes no network
calls (except the release-build update check). It is the Tauri counterpart of
[`apps/desktop-electron`](../desktop-electron/README.md) — same screens, same port, a different
split between the privileged side and the UI. Why both exist:
[ADR 0002](../../docs/adr/0002-desktop-tauri-alongside-electron.md).

Built with Tauri 2.12, Rust (rusqlite, bundled SQLite), React 19, Vite and CSS Modules.

## Prerequisites

- Rust stable via `rustup`
- Platform webview prerequisites: <https://v2.tauri.app/start/prerequisites/>

## Commands

```bash
bun run dev            # tauri dev: Vite on :1420 + the app window (repo root: bun run dev:desktop-tauri)
bun run test           # renderer tests (Vitest + jsdom)
bun run test:rust      # Rust core tests (also regenerates src/bindings.ts)
bun run verify:rust    # fmt + clippy -D warnings + cargo test + stale-bindings check
bun run bindings       # regenerate src/bindings.ts only
bun run check-types    # tsc
bun run build          # type-check, then vite build -> dist/ (what `turbo run build` runs)
bun run bundle         # tauri build: release binary + .app/.dmg (repo root: bun run bundle:desktop-tauri)
```

`bun run tauri <cmd>` runs any other Tauri CLI command.

### Where the checks run

`verify:rust` is the Rust half of "verified". It runs in three places, always the same script
([ADR 0003](../../docs/adr/0003-desktop-ci-pipelines.md)):

- **pre-push** (Lefthook), when the push touches `src-tauri/` or `packages/i18n/messages/`;
- **the release gate** — the Linux `verify` job that `release-desktop-tauri.yml`'s macOS jobs
  `needs:`;
- **on demand** — `ci-desktop-tauri.yml`, dispatched from the Actions tab. Dispatch it on `main`
  after a `Cargo.lock` change: that run is the only one that saves the Rust cache, and the release
  gate restores it.

Run it before pushing Rust that was only compiled on macOS: `cfg(target_os = …)` code is the
classic way a change passes locally and fails clippy on Linux.

## Why this app exists

`packages/domain` declares the `ITodoRepository` port. `packages/infra-db` implements it against
Postgres for the server, and the Electron app implements it against SQLite in its main process.
This app is the **third adapter**: `src/infrastructure/tauri-todo.repository.ts`.

In Tauri the privileged side is Rust, where the TypeScript use cases cannot run. So the split is:

```
webview (TypeScript)                                   Rust core (src-tauri/)
features/todos ─► window.api.todos                      todos.rs
                   └─ @monorepo-template/application      #[tauri::command] todos_* ─► rusqlite
                        createTodo / listTodos / …          fixed, parameterized SQL
                        └─ TauriTodoRepository ─invoke─►    transactions, migrations
features/settings ─► window.api.settings ──invoke──►   settings.rs ─► settings.json
                   ◄──── event "settings-changed" ────  (also fired by the tray)
```

The use cases run unchanged in the webview. The adapter owns no SQL — each method is one typed
command. `tauri-todo.repository.test.ts` drives the real use cases through it, with Tauri's
`mockIPC` standing in for the Rust core, so the test also checks the command names and argument
keys that go over the wire.

The trade-off and the alternatives (SQL from the webview, everything in Rust, a Node sidecar) are
in the ADR and in the hub's
[tauri-architecture](https://github.com/csdev19/general-knowledge/blob/main/desktop/tauri-architecture.md).

## Layout

```
src-tauri/src/
├── lib.rs        # composition root: plugins, managed state, window + run events
├── bindings.rs   # the typed IPC contract; its test writes ../src/bindings.ts
├── db.rs         # open, PRAGMAs, versioned migrations (user_version)
├── todos.rs      # DTOs, SQL, and the todos_* commands
├── settings.rs   # settings.json store, theme, the settings_* commands, "settings-changed"
├── tray.rs       # native menu, translated from packages/i18n/messages/*.json
└── updater.rs    # background update check (release builds only)
src/
├── bindings.ts                               # GENERATED — do not edit
├── api/                                      # DesktopApi: use cases + settings over the bindings
├── infrastructure/tauri-todo.repository.ts  # the ITodoRepository adapter
├── app/, features/, ui/                      # screens, ported from desktop-electron
└── test/                                     # fake window.api + render helpers
```

## The IPC contract

`src-tauri/src/bindings.rs` registers every command and event. `src/bindings.ts` is generated from
it by [tauri-specta](https://github.com/specta-rs/tauri-specta) and committed. After changing a
command signature, run `bun run bindings` and commit the result — `ci-desktop-tauri.yml` fails on a
stale file.

- tauri-specta for Tauri 2 is a release candidate. `specta`, `specta-typescript` and
  `tauri-specta` are pinned with `=` in `Cargo.toml`; bump the three together.
- Timestamps cross as epoch-millisecond `f64` (an `i64` would need `bigint`). specta types an `f64`
  as `number | null`, so the adapter converts once and treats `null` as an error.
- `UpdateTodo.categoryId` has three states (absent, `null`, a string); the command takes an explicit
  `CategoryPatch` because "absent" does not survive JSON.
- The Rust `Locale` enum mirrors `SUPPORTED_LOCALES`. `src/api/types.ts` asserts at compile time
  that the two agree, so adding a locale to `packages/i18n` fails `check-types` until Rust has it.

## Shared packages

| Package       | Where          | How                                                                    |
| ------------- | -------------- | ---------------------------------------------------------------------- |
| `domain`      | webview        | the `ITodoRepository` port, Zod schemas validated before each use case |
| `application` | webview        | the use cases, given `TauriTodoRepository`                             |
| `i18n`        | webview + Rust | `I18nProvider` in the UI; the JSON catalogs embedded for the tray      |
| `tokens`      | webview        | `@import "@monorepo-template/tokens/css/desktop"` in `base.css`        |

They are `devDependencies`: Vite bundles them into `dist/`, and nothing ships as a Node module.

## Settings, theme and tray

The Rust core owns the settings (`settings.json` in the app config dir). Every change — from the
Settings screen or the tray — goes through `settings::apply`, which persists, sets the window
theme, rebuilds the tray menu and emits `settings-changed`, so the file, the tray and the UI never
disagree.

The theme needs no branching in React: Rust calls `set_theme` on the window, the webview's
`prefers-color-scheme` follows the window appearance, and `app/theme.tsx` toggles `.dark`.

Closing the window hides it; the tray keeps the app alive, and Quit lives in the tray menu. On
macOS, clicking the Dock icon brings the window back.

## Data

`app.db` lives in the app data dir (`~/Library/Application Support/<identifier>/` on macOS). The
schema is an ordered list of steps in `db.rs`, each run once in its own transaction and recorded in
`PRAGMA user_version`. Append steps; never edit a shipped one.

## Security

- `tauri.conf.json` sets a strict CSP (`'self'` plus the IPC endpoints).
- `capabilities/default.json` grants only `core:default`. The app's own commands are the only other
  thing the webview can call; the updater runs from Rust, so it needs no webview permission.
- Rust re-checks the todo title and scopes every query by `user_id`, whatever the webview sends.

## Signing, release and auto-update

Replace the placeholders before shipping:

- `identifier` in `tauri.conf.json` (`com.example.desktop-tauri`). It keys the data directory and
  the update channel — changing it after the first release orphans existing installs' data.
- `productName` and the window `title`.
- `plugins.updater.pubkey` — generate a key pair with `bun run tauri signer generate`, put the
  public key here, keep the private key secret.
- `plugins.updater.endpoints` — `https://github.com/<owner>/<repo>/releases/latest/download/latest.json`.

**In CI:** `.github/workflows/release-desktop-tauri.yml` runs `verify` and `verify:rust` on Linux
against the tagged SHA (and fails if the tag does not match the `version` in `tauri.conf.json`),
then builds macOS arm64 and x64,
signs with a Developer ID, notarizes, and attaches the DMGs, the signed updater bundles and
`latest.json` to a draft GitHub Release. The workflow header lists the secrets; the Apple ones are
the same as the Electron release's. Updates reach users once the release is published (not draft,
not prerelease).

**Locally:** `bun run bundle` builds an unsigned `.app` and `.dmg`. Updater artifacts are off in
`tauri.conf.json` (`createUpdaterArtifacts: false`) so this works without the private key; the
release workflow turns them on.

In release builds the app checks for an update on launch, downloads and installs it in the
background, and runs the new version from the next launch. With the placeholder endpoint the check
fails and is logged — never fatal. Dev builds skip it.

Windows and Linux are not released; the workflow ends with notes on adding them.

## Invariants

- **One React.** `vite.config.ts` and `vitest.config.ts` dedupe `react`/`react-dom`. Workspace
  packages otherwise resolve their own React and every hook fails with `dispatcher is null`,
  leaving a blank window.
- **`dev` vs `dev:renderer`.** `dev` runs `tauri dev`, whose `beforeDevCommand` runs `dev:renderer`
  (plain Vite). Pointing `beforeDevCommand` at `dev` would recurse.
- **Fixed dev port.** Vite must serve on 1420 (`strictPort`), matching `build.devUrl`.
- **Renderer before release builds.** The Rust release build embeds `dist/`; `tauri build` runs
  `bun run build` first through `beforeBuildCommand`.
- **No shared tsconfig.** `tsconfig.json` is self-contained, so the `desktop-local-first` pattern
  can drop `packages/config`.
