# ADR 0004 — Local env files come from one command, behind a provider interface

- **Status:** accepted
- **Date:** 2026-10-26
- **Applies to:** `scripts/env/`, root `package.json` (`env:pull`, `db:*`), `apps/server-hono/package.json`
  (`test:integration`), `.infisical.json`, `README.md`, `apps/documentation/.../environment-variables.mdx`
- **Applies the hub playbook:**
  [infisical-secrets](https://github.com/csdev19/general-knowledge/blob/main/infra/infisical-secrets.md),
  [environment-inventory](https://github.com/csdev19/general-knowledge/blob/main/infra/environment-inventory.md)
- **Precedent:** gymtrack-monorepo `scripts/env-pull.sh` (Infisical-only, Bash), in daily use since 2026-10-25.

## Context

A fresh clone of the template had no working way to get its environment. The README recommended
dotenvx and said encrypted `.env` files were "already committed", but `.gitignore` ignores `.env`, no
encrypted file exists, and the docs page described dotenvx as a proposal. What people actually did
was copy every `.env.example` by hand. The `db:*` scripts called `dotenvx`, which no `package.json`
declares, so they only worked on machines that happened to have it installed globally.

Products built from the template already moved to Infisical (GymTrack, Kaipu), each with its own
pull script. The owner wants the template to carry that flow, but with the provider abstracted:
"only a script that pulls the information".

## Decision

1. **`bun run env:pull` is the interface.** One Bun script (`scripts/env/pull.ts`) writes every kept
   app's `.env`. Nothing else talks to the provider; `bun dev`, `db:*` and tests read the files.
2. **What is written is declarative and provider-neutral** (`scripts/env/config.ts`): per target, a
   file, a _consumer_, the required keys, an optional key filter. Targets whose app directory is
   missing are skipped, so `customize` needs no change.
3. **How values are fetched is a provider** (`scripts/env/providers/`): `check()` and
   `fetch({ environment, consumer })`. Infisical is the default and the only one shipped; it maps a
   consumer to a tag and reads the folders `/public`, `/database`, `/auth`. `ENV_PROVIDER=<name>`
   switches per run.
4. **All or nothing, values never printed.** Every target is fetched and checked before any file is
   replaced; files are `0600` and written through a temp name. The provider reads values into a
   private temp file, not stdout.
5. **`dotenvx` is gone.** `db:*` and `test:integration` load their file with `bun --env-file`, which
   needs no extra tool and passes the values to the spawned command.

## Alternatives rejected

- **Keep the dotenvx proposal** (encrypted `.env` committed, `.env.keys` passed around). Never
  implemented here, and it puts key distribution on people instead of on a secrets manager with
  per-folder permissions and audit.
- **Copy GymTrack's Bash script as is.** It works, but Infisical is wired into every line; swapping
  providers would mean rewriting it. TypeScript also matches the template's other scripts.
- **`infisical run -- bun dev`** (fetch on every start). Every dev session would depend on the
  provider being up and on a valid login; a pulled file keeps working offline.
- **Derive required keys from the zod schemas.** Schemas are per app and some apps have none;
  an explicit list per target is easier to read and to keep honest.

## Consequences

- New developers run `infisical login`, `infisical init` once per clone, then `bun run env:pull`.
  Without a provider they still copy `.env.example` files; nothing forces Infisical.
- Adding a variable means: the app's schema, its `.env.example`, `scripts/env/config.ts` if
  required, the Infisical tag, and the docs table.
- Adding a provider is one file plus one registry line.
- The Infisical CLI cannot export folders recursively; a folder added in Infisical must also be
  added to `FOLDERS`, or its keys are silently absent (the required-key check catches the
  required ones).

## Not done here

- Production: CI still injects values from GitHub secrets and variables.
- A `with-env` wrapper that fetches per command (GymTrack has one for `db:*`); `db:*` read the
  pulled file instead.
- A second provider.

## What would reopen this

- Infisical gaining recursive export: drop `FOLDERS`.
- A product needing values that must never touch disk: per-command fetch for that consumer.
- CI moving to the same provider: reuse the provider modules from a CI script.
