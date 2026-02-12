# Development Rules

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
