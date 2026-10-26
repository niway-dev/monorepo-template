/**
 * What `bun run env:pull` writes, and from which provider. The only file to edit when an
 * app gains or loses a variable. Provider-agnostic: a target names a *consumer* (who
 * needs the values), not where they live; each provider maps consumers to its own model
 * (Infisical: tags; another provider: a path, a project, a vault item...).
 *
 * Targets whose app directory does not exist are skipped, so `bun run customize`
 * needs no change here when it deletes apps.
 */
export type EnvTarget = {
  /** File to write, relative to the repo root. */
  file: string;
  /** Consumer name; the Infisical provider reads it as a tag slug. */
  consumer: string;
  /** Keys that must be present, or the whole pull fails without writing anything. */
  required: string[];
  /** Keep only keys matching this pattern (e.g. Expo's bundle-inlined `EXPO_PUBLIC_*`). */
  keep?: RegExp;
};

export type EnvConfig = {
  /** Default provider; override per run with ENV_PROVIDER=<name>. */
  provider: string;
  /** Default environment slug; override with `--env <slug>`. */
  environment: string;
  targets: EnvTarget[];
};

const SERVER_REQUIRED = ["DATABASE_URL", "BETTER_AUTH_SECRET", "CORS_ORIGIN"];

export const envConfig: EnvConfig = {
  provider: "infisical",
  environment: "dev",
  targets: [
    // Client-server: a Hono or Elysia API plus its web app. Wrangler auto-loads `.env` for
    // the Worker; Vite reads the `VITE_*` keys from the same file. The web app proxies
    // auth and data to the API, so it needs only the API's URL.
    { file: "apps/server-hono/.env", consumer: "server-runtime", required: SERVER_REQUIRED },
    { file: "apps/server-elysia/.env", consumer: "server-runtime", required: SERVER_REQUIRED },
    { file: "apps/web-hono/.env", consumer: "web-runtime", required: ["VITE_SERVER_URL"] },
    { file: "apps/web-elysia/.env", consumer: "web-runtime", required: ["VITE_SERVER_URL"] },

    // Fullstack (no separate API): the app runs Better Auth and opens the database itself.
    {
      file: "apps/fullstack-fn-only/.env",
      consumer: "fullstack-runtime",
      required: ["DATABASE_URL", "BETTER_AUTH_SECRET", "BETTER_AUTH_URL"],
    },
    {
      file: "apps/fullstack-fn-and-convex/.env",
      consumer: "fullstack-convex-runtime",
      required: [
        "DATABASE_URL",
        "BETTER_AUTH_SECRET",
        "BETTER_AUTH_URL",
        "VITE_CONVEX_URL",
        "JWT_PRIVATE_JWK",
        "JWT_KID",
      ],
    },

    // Mobile: Expo inlines EXPO_PUBLIC_* into the bundle, so nothing else may land here.
    {
      file: "apps/mobile/.env",
      consumer: "mobile-runtime",
      required: ["EXPO_PUBLIC_API_URL"],
      keep: /^EXPO_PUBLIC_/,
    },
    {
      file: "apps/mobile-convex/.env",
      consumer: "mobile-convex-runtime",
      required: ["EXPO_PUBLIC_CONVEX_URL", "EXPO_PUBLIC_CONVEX_SITE_URL"],
      keep: /^EXPO_PUBLIC_/,
    },
  ],
};
