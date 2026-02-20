---
name: customize-template
description: Provides complete context for customizing this monorepo template. Knows which apps, packages, scripts, CI/CD steps, and dependencies to remove based on the user's chosen architecture pattern. Use when the user wants to strip down the template to only what they need.
---

# Customize Monorepo Template — Full Context

This skill provides the removal map for customizing the monorepo template. The template ships with all architecture patterns; users pick one and remove the rest.

## Template Inventory

### Apps

| App                         | Path                              | Purpose                                               | Framework                                    |
| --------------------------- | --------------------------------- | ----------------------------------------------------- | -------------------------------------------- |
| `web`                       | `apps/web/`                       | Frontend SPA (client in client-server pattern)        | TanStack Start, React 19, Cloudflare Workers |
| `server`                    | `apps/server/`                    | Backend API (server in client-server pattern)         | Elysia, Cloudflare Workers                   |
| `fullstack-fn-only`         | `apps/fullstack-fn-only/`         | Fullstack with TanStack serverFn only (no API server) | TanStack Start, React 19, Vite               |
| `fullstack-tanstack-elysia` | `apps/fullstack-tanstack-elysia/` | Fullstack with Elysia API embedded in TanStack Start  | TanStack Start, Elysia, Eden, Vite           |
| `mobile`                    | `apps/mobile/`                    | Cross-platform mobile app                             | Expo 54, React Native, Expo Router           |
| `fumadocs`                  | `apps/fumadocs/`                  | Documentation site                                    | Next.js 16, Fumadocs, MDX                    |

### Packages

| Package                          | Path                    | Purpose                                                  | Used By                                                           |
| -------------------------------- | ----------------------- | -------------------------------------------------------- | ----------------------------------------------------------------- |
| `@monorepo-template/domain`      | `packages/domain/`      | Pure domain layer: schemas, types, constants, interfaces | ALL apps                                                          |
| `@monorepo-template/application` | `packages/application/` | Use cases layer (server-only)                            | web, server, fullstack-fn-only, fullstack-tanstack-elysia         |
| `@monorepo-template/infra-db`    | `packages/infra-db/`    | Drizzle ORM, Neon PostgreSQL, repositories, migrations   | web, server, fullstack-fn-only, fullstack-tanstack-elysia         |
| `@monorepo-template/infra-auth`  | `packages/infra-auth/`  | Better Auth configuration                                | web, server, mobile, fullstack-fn-only, fullstack-tanstack-elysia |
| `@monorepo-template/infra-env`   | `packages/infra-env/`   | Zod env validation schemas                               | web, server, fullstack-fn-only, fullstack-tanstack-elysia         |
| `@monorepo-template/web-ui`      | `packages/web-ui/`      | Shared React UI components (shadcn/ui)                   | web, fullstack-fn-only, fullstack-tanstack-elysia                 |
| `@monorepo-template/config`      | `packages/config/`      | Shared tsconfig.base.json                                | ALL packages                                                      |

### Root package.json Scripts

| Script                                   | Related To                       |
| ---------------------------------------- | -------------------------------- |
| `dev:web`                                | `apps/web`                       |
| `dev:server`                             | `apps/server`                    |
| `dev:native`                             | `apps/mobile`                    |
| `dev:fullstack-fn`                       | `apps/fullstack-fn-only`         |
| `dev:fullstack-elysia`                   | `apps/fullstack-tanstack-elysia` |
| `db:*` (push, studio, generate, migrate) | `@monorepo-template/infra-db`    |

### Root package.json Catalog Dependencies

| Catalog Entry                      | Used By                             |
| ---------------------------------- | ----------------------------------- |
| `elysia`                           | server, fullstack-tanstack-elysia   |
| `@elysiajs/eden`                   | fullstack-tanstack-elysia           |
| `@elysiajs/cors`                   | server                              |
| `@better-auth/expo`                | mobile                              |
| `better-auth`                      | web, server, fullstack-\*, mobile   |
| `tailwindcss`, `@tailwindcss/vite` | web, fullstack-\*, web-ui, fumadocs |
| `@vitejs/plugin-react`             | web, fullstack-\*                   |
| `vite`                             | web, fullstack-\*                   |

### CI/CD Workflows

**`.github/workflows/pr-validation.yml`:**

- Step "Build frontend" → references `apps/web`
- Step "Build backend" → references `apps/server`

**`.github/workflows/deploy-production.yml`:**

- Step "Build Frontend step" → references `apps/web`
- Step "Deploy Frontend to Cloudflare Workers" → references `apps/web`
- Step "Deploy Backend to Cloudflare Workers" → references `apps/server`

### Environment Variable Schemas in `infra-env`

| Schema                     | Used By                                                    |
| -------------------------- | ---------------------------------------------------------- |
| `serverEnvSchema`          | `apps/server`                                              |
| `webServerEnvSchema`       | `apps/web`                                                 |
| `webClientEnvSchema`       | `apps/web`                                                 |
| `fullstackServerEnvSchema` | `apps/fullstack-fn-only`, `apps/fullstack-tanstack-elysia` |

---

## Architecture Patterns

Users must choose ONE primary architecture pattern. The patterns are mutually exclusive for the web layer.

### Pattern A: Client-Server (web + server)

**Keep:** `apps/web/`, `apps/server/`
**Remove:** `apps/fullstack-fn-only/`, `apps/fullstack-tanstack-elysia/`

### Pattern B: Fullstack with TanStack serverFn Only

**Keep:** `apps/fullstack-fn-only/`
**Remove:** `apps/web/`, `apps/server/`, `apps/fullstack-tanstack-elysia/`

### Pattern C: Fullstack with Elysia inside TanStack Start

**Keep:** `apps/fullstack-tanstack-elysia/`
**Remove:** `apps/web/`, `apps/server/`, `apps/fullstack-fn-only/`

### Optional: Mobile App

**If removing mobile:**

- Delete `apps/mobile/`
- Remove `dev:native` script from root `package.json`
- Remove `@better-auth/expo` from root catalog (if no other consumer)
- The `domain` package stays (other apps use it)

**If keeping mobile:**

- Keep `apps/mobile/`
- Keep `@better-auth/expo` in catalog
- Remember: mobile ONLY imports from `@monorepo-template/domain`

### Optional: Documentation Site

**If removing docs:**

- Delete `apps/fumadocs/`
- No other cleanup needed (fumadocs has no internal package dependencies)

**If keeping docs:**

- Keep `apps/fumadocs/`

---

## Detailed Removal Instructions Per Pattern

### Pattern A: Client-Server — What to Remove

**Delete directories:**

```
rm -rf apps/fullstack-fn-only/
rm -rf apps/fullstack-tanstack-elysia/
```

**Root `package.json` — remove scripts:**

- `"dev:fullstack-fn"` line
- `"dev:fullstack-elysia"` line

**Root `package.json` — catalog cleanup:**

- Keep `elysia` (server uses it)
- Keep `@elysiajs/cors` (server uses it)
- Remove `@elysiajs/eden` (only fullstack-tanstack-elysia used it)

**`packages/infra-env/` — cleanup schemas:**

- Remove `fullstackServerEnvSchema` export and file (only fullstack apps used it)
- Keep `serverEnvSchema`, `webServerEnvSchema`, `webClientEnvSchema`

**CI/CD — no changes needed:**

- `pr-validation.yml` already builds web + server
- `deploy-production.yml` already deploys web + server

---

### Pattern B: Fullstack serverFn Only — What to Remove

**Delete directories:**

```
rm -rf apps/web/
rm -rf apps/server/
rm -rf apps/fullstack-tanstack-elysia/
```

**Root `package.json` — remove scripts:**

- `"dev:web"` line
- `"dev:server"` line
- `"dev:fullstack-elysia"` line

**Root `package.json` — catalog cleanup:**

- Remove `elysia` (no Elysia consumers left)
- Remove `@elysiajs/eden` (no consumers)
- Remove `@elysiajs/cors` (no consumers)

**`packages/infra-env/` — cleanup schemas:**

- Remove `serverEnvSchema` (apps/server is gone)
- Remove `webServerEnvSchema` and `webClientEnvSchema` (apps/web is gone)
- Keep `fullstackServerEnvSchema`

**CI/CD — update both workflows:**

`pr-validation.yml`:

- Change "Build frontend" step: `working-directory: apps/web` → `working-directory: apps/fullstack-fn-only`
- Remove "Build backend" step entirely
- Update env vars in the build step to match fullstack-fn-only's needs

`deploy-production.yml`:

- Change "Build Frontend step" to point to `apps/fullstack-fn-only`
- Change "Deploy Frontend to Cloudflare Workers" to point to `apps/fullstack-fn-only`
- Remove "Deploy Backend to Cloudflare Workers" step entirely
- Update secrets/vars to match fullstack-fn-only's needs (no CORS_ORIGIN, no separate server URL)

**Root `package.json` — remove db script env source update:**

- Change `db:push`, `db:studio`, `db:generate`, `db:migrate` to source `.env` from `apps/fullstack-fn-only/.env` instead of `apps/server/.env`

---

### Pattern C: Fullstack with Elysia inside TanStack — What to Remove

**Delete directories:**

```
rm -rf apps/web/
rm -rf apps/server/
rm -rf apps/fullstack-fn-only/
```

**Root `package.json` — remove scripts:**

- `"dev:web"` line
- `"dev:server"` line
- `"dev:fullstack-fn"` line

**Root `package.json` — catalog cleanup:**

- Keep `elysia` (fullstack-tanstack-elysia uses it)
- Keep `@elysiajs/eden` (fullstack-tanstack-elysia uses it)
- Remove `@elysiajs/cors` (only standalone server used CORS plugin — embedded Elysia doesn't need it)

**`packages/infra-env/` — cleanup schemas:**

- Remove `serverEnvSchema` (apps/server is gone)
- Remove `webServerEnvSchema` and `webClientEnvSchema` (apps/web is gone)
- Keep `fullstackServerEnvSchema`

**CI/CD — update both workflows:**

`pr-validation.yml`:

- Change "Build frontend" step: `working-directory: apps/web` → `working-directory: apps/fullstack-tanstack-elysia`
- Remove "Build backend" step entirely
- Update env vars to match fullstack-tanstack-elysia's needs

`deploy-production.yml`:

- Change "Build Frontend step" to point to `apps/fullstack-tanstack-elysia`
- Change "Deploy Frontend to Cloudflare Workers" to point to `apps/fullstack-tanstack-elysia`
- Remove "Deploy Backend to Cloudflare Workers" step entirely
- Update secrets/vars accordingly

**Root `package.json` — update db script env source:**

- Change `db:*` scripts to source `.env` from `apps/fullstack-tanstack-elysia/.env` instead of `apps/server/.env`

---

## Removing Mobile

When the user opts out of mobile, regardless of pattern:

**Delete:**

```
rm -rf apps/mobile/
```

**Root `package.json`:**

- Remove `"dev:native"` script
- Remove `"@better-auth/expo"` from catalog (check no other consumer first)

**No package changes needed** — mobile only imports `domain`, which stays.

---

## Removing Documentation Site

When the user opts out of docs:

**Delete:**

```
rm -rf apps/fumadocs/
```

**No other changes needed** — fumadocs has zero internal package dependencies.

---

## Future: Convex Integration

When Convex is NOT selected (default for now since it's not yet integrated):

**Remove all Convex-related skills:**

```
rm -rf .claude/skills/convex/
rm -rf .claude/skills/convex-agents/
rm -rf .claude/skills/convex-best-practices/
rm -rf .claude/skills/convex-component-authoring/
rm -rf .claude/skills/convex-cron-jobs/
rm -rf .claude/skills/convex-file-storage/
rm -rf .claude/skills/convex-functions/
rm -rf .claude/skills/convex-http-actions/
rm -rf .claude/skills/convex-migrations/
rm -rf .claude/skills/convex-realtime/
rm -rf .claude/skills/convex-schema-validator/
rm -rf .claude/skills/convex-security-audit/
rm -rf .claude/skills/convex-security-check/
```

If Convex IS selected in the future, these skills stay and a `packages/infra-convex` package would be added following the `infra-*` naming convention.

---

## Post-Cleanup Checklist

After removing apps/packages, always:

1. **Run `bun install`** to update the lockfile
2. **Run `bun run build`** to verify all packages still build
3. **Run `bun run check-types`** to verify no broken type references
4. **Search for dead imports** — grep for removed package names across remaining code:
   ```
   grep -r "fullstack-fn-only\|fullstack-tanstack-elysia\|apps/web\|apps/server\|apps/mobile\|fumadocs" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.yml" --include="*.yaml" .
   ```
5. **Update CLAUDE.md** if architecture examples reference removed apps
6. **Rename the project** — find-and-replace `monorepo-template` with the actual project name in:
   - Root `package.json` (name field)
   - All `package.json` files (package scope `@monorepo-template/` → `@your-project/`)
   - CI/CD workflow build filter: `--filter='@monorepo-template/*'` → `--filter='@your-project/*'`
   - Any imports across the codebase referencing `@monorepo-template/`

---

## Rename Instructions

When renaming the project:

**Scope replacement** (`@monorepo-template` → `@{new-name}`):

Files to update:

- `package.json` (root) — `name` field
- `packages/*/package.json` — `name` field (e.g., `@monorepo-template/domain` → `@{new-name}/domain`)
- `packages/*/package.json` — `dependencies` referencing `@monorepo-template/*`
- `apps/*/package.json` — `dependencies` referencing `@monorepo-template/*`
- All source files with `import ... from "@monorepo-template/..."` or `import("@monorepo-template/...")`
- `.github/workflows/*.yml` — build filter `--filter='@monorepo-template/*'`
- `turbo.json` — if any filter references exist
- `CLAUDE.md` — any references to `@monorepo-template/*`
- `db:*` scripts in root `package.json` — `-F @monorepo-template/infra-db`
