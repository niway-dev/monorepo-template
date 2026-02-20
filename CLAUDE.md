# Development Rules

## Template Customization

This is a multi-pattern template. Before starting development, customize it:

- `bun run customize` — Interactive CLI: choose pattern, optional features, project name. Handles directory deletion, package.json cleanup, CI/CD generation, infra-env cleanup, lint config cleanup, and scope rename. Self-deletes after completion.
- `bun run rename <scope>` — Standalone scope rename (`@monorepo-template` -> `@your-scope` across 60+ files). Use if you only need to rename.

Always recommend `bun run customize` on a fresh clone. Do NOT do manual file-by-file customization.

## Development Workflow: MVP First, Then Refactor

When building new features, follow a two-phase approach:

### Phase 1: MVP (Speed)

Build the feature the simplest way possible. All logic can live inline in the frontend and backend:

- Add routes with inline business logic directly in `apps/server/src/routes/`
- Add serverFn with inline logic in `apps/web/src/functions/`
- Use `@monorepo-template/infra-db` repositories directly from route handlers
- Focus on making it work end-to-end (UI -> API -> DB)
- No need for use cases, domain interfaces, or mappers at this stage

### Phase 2: Refactor to Architecture Standards

Once the feature works, refactor to follow the layer architecture:

1. **Domain** (`packages/domain/`) -- Extract interfaces, schemas, types, constants
2. **Application** (`packages/application/`) -- Extract use cases that depend only on domain interfaces
3. **Infrastructure** (`packages/infra-db/`, `packages/infra-auth/`) -- Repository implementations, mappers
4. **Consumers** (`apps/*`) -- Thin handlers that wire application use cases with infra implementations

The dependency rule is strict: domain <- application <- infra, and only apps wire them together.

### When to Refactor

- When a second consumer needs the same logic (e.g., both web serverFn and API route)
- When business logic exceeds ~15 lines in a route handler
- When the feature is stable and tested

## Architecture

This project uses DDD + Hexagonal Architecture with layer-first package structure:

```
packages/domain/        Pure. Mobile-safe. Constants, schemas, types, interfaces.
packages/application/   Use cases. Server-only. Depends on domain interfaces.
packages/infra-db/      Infrastructure. Server-only. Drizzle repos, mappers, schemas.
packages/infra-auth/    Infrastructure. Server-only. Better Auth configuration.
```

Infrastructure packages use the `infra-*` naming convention to make architectural intent explicit.

## Package Import Rules

- `domain` never imports from `application` or `infra-*`
- `application` never imports from `infra-*` (uses domain interfaces)
- `infra-*` never imports from `application`
- Mobile app (`apps/mobile/`) only imports from `@monorepo-template/domain`
