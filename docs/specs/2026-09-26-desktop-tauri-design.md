# Desktop app on Tauri, alongside Electron — design

- **Date:** 2026-09-26
- **Status:** approved (conversation with the product owner)
- **Decision record:** [ADR 0002](../adr/0002-desktop-tauri-alongside-electron.md)

## Goal

The template ships two desktop runtimes a generated project can choose between:

- `apps/desktop-electron` — the existing local-first Electron app, renamed from `apps/desktop`,
  behaviour unchanged.
- `apps/desktop-tauri` — a new local-first Tauri 2 app at feature parity: on-device SQLite todos,
  settings (locale + theme), a translated tray menu, close-to-tray, auto-update, CI and a signed
  macOS release workflow.

The Tauri app starts from the Rimi scaffold (Tauri 2 + React/Vite on the workspace catalog, the
unprefixed token sheet, `@monorepo-template/i18n`, React deduped in Vite).

## Success criteria

1. `bun run dev:desktop-tauri` opens a window that lists, creates, toggles and deletes todos stored
   in SQLite under the app data dir; changing the locale in Settings or in the tray updates both.
2. `bun run customize --pattern desktop-local-first --desktop=tauri` produces a repo with only
   `apps/desktop-tauri` and the packages it consumes, and its scripts and workflows are all valid.
3. `--desktop` alone still means Electron; every existing customizer case keeps passing.
4. `ci-desktop-tauri.yml` type-checks, tests (vitest + cargo), lints (clippy) and checks that the
   generated bindings are current. `release-desktop-tauri.yml` builds, signs and notarizes macOS
   arm64 + x64 on a `desktop-tauri-v*` tag.

## Architecture: hybrid (option D)

The use cases stay in TypeScript; Rust owns the database.

```
renderer (webview, TS)                                   Rust core
────────────────────────────────                         ──────────────────────────
features/todos  ──► DesktopApi.todos                      commands (tauri-specta)
                     └─ @monorepo-template/application     todos_find_by_id
                          createTodo / listTodos / …        todos_list / todos_list_paginated
                          └─ TauriTodoRepository  ──invoke──► todos_create / todos_update
                               implements ITodoRepository   todos_delete
                                                           └─ rusqlite, fixed SQL, migrations
features/settings ─► DesktopApi.settings ─────invoke──► settings_get / set_locale / set_theme
                     ◄──── event "settings-changed" ────  (also emitted by the tray)
```

- The webview never sends SQL. Each command is a fixed, parameterized statement.
- Domain rules (Zod schemas, use-case invariants) run in TS. Rust enforces types (serde) and SQL
  constraints only. A compromised webview could bypass domain rules, but only over the local user's
  own data — acceptable for a single-user local-first app, and recorded in the ADR.
- `TauriTodoRepository` is the third adapter of `ITodoRepository`, after `infra-db` (Postgres) and
  the Electron main-process SQLite adapter.

Alternatives considered (details and sources in ADR 0002): SQL from the webview via
`@tauri-apps/plugin-sql` (arbitrary SQL crosses the trust boundary; no transactions), everything in
Rust (duplicates the TS domain), and a Bun/Node sidecar (ships a JS runtime, defeating Tauri).

## Layout

```
apps/desktop-tauri/
├── src-tauri/src/
│   ├── lib.rs          composition root: plugins, state, commands, tray, close→hide, theme
│   ├── db.rs           open + PRAGMAs + versioned migrations (user_version)
│   ├── todos.rs        TodoRow + SQL + #[tauri::command] handlers
│   ├── settings.rs     settings.json in app_config_dir, emits "settings-changed"
│   ├── tray.rs         native menu translated from packages/i18n/messages/*.json (include_str!)
│   ├── specta.rs       the tauri-specta builder shared by the app and the exporter
│   └── bin/export_bindings.rs   writes ../src/bindings.ts
└── src/
    ├── bindings.ts                              generated, committed
    ├── infrastructure/tauri-todo.repository.ts  ITodoRepository over the bindings
    ├── api/                                     DesktopApi = use cases + settings bindings
    ├── app/, features/, ui/                     ported from desktop-electron (CSS Modules)
    └── test/                                    fake-api, render helpers
```

The renderer consumes the same `TodosApi` / `SettingsApi` shapes Electron exposes on `window.api`,
so the pages and their component tests port nearly verbatim. The UI is **copied**, not extracted
into a shared package; extract it when a third consumer appears.

## Data

Same schema as the Electron adapter: snake_case columns, epoch-millisecond timestamps, `completed`
as 0/1. `LOCAL_USER_ID` is a TS constant; Rust still takes `user_id` so the port keeps its shape.
Migrations run in a transaction and bump `PRAGMA user_version`.

## Tray, theme, window

- The tray menu (Show / Language ▸ en, es / Quit) is translated in Rust from the same message
  catalogs the renderer uses, embedded at compile time.
- Theme: Rust calls `set_theme` on the window from the stored preference; the renderer follows
  `prefers-color-scheme` and toggles `.dark`, as the Electron app does.
- Closing the window hides it; Quit lives in the tray.

## Security

- A real CSP replaces the scaffold's `null`.
- Capabilities grant only `core:default`; the app's own commands are the only other thing the
  webview can call. The updater runs from Rust, so the webview needs no updater permission.

## Auto-update and release

- `tauri-plugin-updater` with Tauri's own signing key (`TAURI_SIGNING_PRIVATE_KEY`); the `pubkey`
  and endpoint in `tauri.conf.json` are documented placeholders. Release builds check on launch,
  download and install in the background, and run the new version from the next launch; dev builds
  skip the check.
- `release-desktop-tauri.yml`: `tauri-apps/tauri-action` on `macos-latest` for arm64 and x64,
  Developer ID signing and notarization with the same Apple secrets as Electron, and a draft GitHub
  Release carrying the signed updater bundles and `latest.json`. The endpoint points at
  `releases/latest/download/latest.json`, so no bucket is needed (a change from the first draft,
  which mirrored Electron's R2 feed — see ADR 0002). The tag must match the app version. Windows and
  Linux stay out, as for Electron.

## Customizer

- `--desktop=electron|tauri`; a bare `--desktop` means `electron`; `--no-desktop` unchanged.
  Interactive mode asks "Desktop app? none / Electron / Tauri".
- Exactly one runtime survives; the other app, its root scripts and its workflows are deleted.
- `desktop-local-first` stays a single pattern and takes its runtime from `--desktop`
  (default `electron`).
- Both runtimes keep `i18n` and `tokens`. Tauri also consumes `application` and `domain` in the
  renderer.

## Renames that affect existing users

| Before                                  | After                                                     |
| --------------------------------------- | --------------------------------------------------------- |
| `apps/desktop`, package `desktop`       | `apps/desktop-electron`, package `desktop-electron`       |
| `dev:desktop`, `test:desktop`           | `dev:desktop-electron`, `test:desktop-electron`           |
| `ci-desktop.yml`, `release-desktop.yml` | `ci-desktop-electron.yml`, `release-desktop-electron.yml` |
| tag `desktop-v*`                        | tag `desktop-electron-v*`                                 |

## Documentation

- Reusable, product-agnostic guidance goes to the general-knowledge hub
  (`desktop/tauri-architecture.md`): the placement options for business logic in Tauri, with
  industry references. The project docs link to it.
- Project docs: ADR 0002, a note on ADR 0001, both app READMEs, the root README, `CLAUDE.md` and the
  `customize-template` skill.

## Non-goals

- Mobile targets (`tauri android|ios`).
- Windows/Linux release pipelines.
- Authentication or sync with `server-hono`.
- A shared desktop UI package.
