# .claude/commands/customize-template.md

---

description: Customize this monorepo template by choosing your architecture pattern, optional features, and project name. Removes everything you don't need.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash(rm -rf:_), Bash(bun install:_), Bash(bun run build:_), Bash(bun run check-types:_), Bash(grep -r:\*), AskUserQuestion

---

# Customize Monorepo Template

## Step 1: Read the skill context

Read `.claude/skills/customize-template/SKILL.md` to load the full removal map, inventory, and instructions.

## Step 2: Ask the user what they want

Use `AskUserQuestion` to ask the following questions. Ask all questions in a SINGLE call so the user can answer at once:

### Question 1: Architecture Pattern

"Which web architecture pattern do you want to use?"

Options:

- **Client-Server** — Separate frontend (`apps/web`) + API backend (`apps/server`). Traditional SPA + REST API on Cloudflare Workers.
- **Fullstack serverFn only** — Single app (`apps/fullstack-fn-only`) using TanStack Start server functions. No separate API server.
- **Fullstack with Elysia** — Single app (`apps/fullstack-tanstack-elysia`) with Elysia API embedded inside TanStack Start. Type-safe API with Eden client.

### Question 2: Mobile App

"Do you want to include the mobile app (Expo + React Native)?"

Options:

- **Yes, keep mobile** — Keep `apps/mobile/` with Expo Router and React Native.
- **No, remove mobile** — Remove `apps/mobile/` entirely.

### Question 3: Documentation Site

"Do you want to include the documentation site (Fumadocs + Next.js)?"

Options:

- **Yes, keep docs** — Keep `apps/fumadocs/` documentation site.
- **No, remove docs** — Remove `apps/fumadocs/` entirely.

### Question 4: Convex

"Will you use Convex in this project?"

Options:

- **No, remove Convex skills** — Remove all `.claude/skills/convex-*` directories (they're pre-loaded for future use).
- **Yes, keep Convex skills** — Keep the Convex skills for when you integrate it.

## Step 3: Confirm the plan

Before making any changes, present a summary to the user:

```
## Customization Plan

**Architecture:** [chosen pattern]
**Mobile:** [keep/remove]
**Docs:** [keep/remove]
**Convex skills:** [keep/remove]

### Will DELETE:
- [list of directories to delete]

### Will MODIFY:
- root package.json (scripts, catalog)
- .github/workflows/pr-validation.yml
- .github/workflows/deploy-production.yml
- packages/infra-env/ (unused schemas)

### Will KEEP:
- [list of remaining apps]
- [list of remaining packages]
```

Ask: "Does this look correct? Should I proceed?"

## Step 4: Execute removals

Follow the instructions from the skill file for the chosen pattern. Execute in this order:

### 4a. Delete app directories

Delete the app directories that are NOT part of the chosen pattern. Use `rm -rf` for each.

### 4b. Delete Convex skills (if chosen)

If the user opted to remove Convex:

```bash
rm -rf .claude/skills/convex/ .claude/skills/convex-agents/ .claude/skills/convex-best-practices/ .claude/skills/convex-component-authoring/ .claude/skills/convex-cron-jobs/ .claude/skills/convex-file-storage/ .claude/skills/convex-functions/ .claude/skills/convex-http-actions/ .claude/skills/convex-migrations/ .claude/skills/convex-realtime/ .claude/skills/convex-schema-validator/ .claude/skills/convex-security-audit/ .claude/skills/convex-security-check/
```

### 4c. Update root package.json

- Remove scripts for deleted apps (`dev:web`, `dev:server`, `dev:native`, `dev:fullstack-fn`, `dev:fullstack-elysia` as needed)
- Remove unused catalog entries (Elysia, Eden, CORS, better-auth/expo as needed)
- Update `db:*` scripts to source `.env` from the correct remaining app directory
- Keep the `dev` and `build` scripts (they use turbo and auto-discover)

### 4d. Update CI/CD workflows

- **pr-validation.yml**: Update "Build frontend" working-directory to the kept app. Remove "Build backend" step if no separate server. Update env vars.
- **deploy-production.yml**: Update build + deploy steps to point to the kept app. Remove backend deploy if no separate server. Update secrets/vars.

### 4e. Clean up infra-env

- Read `packages/infra-env/src/` to find which env schemas exist
- Remove schemas that belong to deleted apps
- Update the package's exports in `package.json` if needed

### 4f. Remove this customization command and skill

After customization is complete, these files are no longer needed:

```bash
rm -rf .claude/skills/customize-template/
rm -f .claude/commands/customize-template.md
```

## Step 5: Ask about renaming

Ask the user: "Do you want to rename the project? The current name is `monorepo-template` with package scope `@monorepo-template/`. Enter your new project name (kebab-case) or skip."

If the user provides a name:

1. Find all files containing `monorepo-template` using Grep
2. Replace `@monorepo-template/` → `@{new-name}/` in all package.json files and source imports
3. Replace root `package.json` `name` field
4. Update CI/CD workflow build filters
5. Update CLAUDE.md references

## Step 6: Verify

Run these commands to verify everything works:

```bash
bun install
bun run build
bun run check-types
```

If any step fails, read the error and fix it before continuing.

## Step 7: Search for dead references

Search for any remaining references to deleted apps or packages:

- Grep for deleted app names in remaining files
- Grep for deleted package imports
- Flag anything found and fix it

## Step 8: Present summary

Show the user:

- What was deleted
- What was modified
- What was kept
- Verification results (build + types pass/fail)
- Any manual steps remaining (like updating env files, deployment configs, etc.)

Ask: "Want me to commit these changes?"
