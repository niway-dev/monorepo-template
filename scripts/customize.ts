#!/usr/bin/env bun
/**
 * Interactive customization script for the monorepo template.
 *
 * Usage: bun run customize
 *
 * Asks for architecture pattern, optional features, and project name,
 * then removes everything you don't need and renames the project.
 *
 * Target: < 30 seconds for full customization.
 */

import { readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Pattern = "client-server" | "fullstack-fn-only" | "fullstack-tanstack-elysia";

interface PatternConfig {
  label: string;
  keep: string[];
  remove: string[];
  scriptsRemove: string[];
  catalogRemove: string[];
  envSchemasRemove: string[];
  envFilesToDelete: string[];
  dbEnvSource: string;
  ciAppDir: string;
  ciNeedsBackend: boolean;
  ciBuildEnv: Record<string, string>;
  ciDeployVars: string[];
  ciDeploySecrets: string[];
  cursorRulesToDelete: string[];
}

// ---------------------------------------------------------------------------
// Pattern Configurations
// ---------------------------------------------------------------------------

const PATTERNS: Record<Pattern, PatternConfig> = {
  "client-server": {
    label: "Client-Server (apps/web + apps/server)",
    keep: ["apps/web", "apps/server"],
    remove: ["apps/fullstack-fn-only", "apps/fullstack-tanstack-elysia"],
    scriptsRemove: ["dev:fullstack-fn", "dev:fullstack-elysia"],
    catalogRemove: ["@elysiajs/eden"],
    envSchemasRemove: ["fullstackServerEnvSchema"],
    envFilesToDelete: ["packages/infra-env/src/fullstack-server.ts"],
    dbEnvSource: "apps/server/.env",
    ciAppDir: "apps/web",
    ciNeedsBackend: true,
    ciBuildEnv: {
      VITE_SERVER_URL: "https://placeholder.example.com",
      DATABASE_URL: "postgresql://placeholder:placeholder@localhost:5432/placeholder",
      BETTER_AUTH_SECRET: "placeholder-secret-for-build-validation",
    },
    ciDeployVars: ["VITE_SERVER_URL"],
    ciDeploySecrets: [
      "CLOUDFLARE_API_TOKEN",
      "CLOUDFLARE_ACCOUNT_ID",
      "DATABASE_URL",
      "BETTER_AUTH_SECRET",
    ],
    cursorRulesToDelete: [],
  },
  "fullstack-fn-only": {
    label: "Fullstack serverFn only (apps/fullstack-fn-only)",
    keep: ["apps/fullstack-fn-only"],
    remove: ["apps/web", "apps/server", "apps/fullstack-tanstack-elysia"],
    scriptsRemove: ["dev:web", "dev:server", "dev:fullstack-elysia"],
    catalogRemove: ["elysia", "@elysiajs/eden", "@elysiajs/cors"],
    envSchemasRemove: ["serverEnvSchema", "webServerEnvSchema", "webClientEnvSchema"],
    envFilesToDelete: [
      "packages/infra-env/src/server.ts",
      "packages/infra-env/src/web-server.ts",
      "packages/infra-env/src/web-client.ts",
    ],
    dbEnvSource: "apps/fullstack-fn-only/.env",
    ciAppDir: "apps/fullstack-fn-only",
    ciNeedsBackend: false,
    ciBuildEnv: {
      DATABASE_URL: "postgresql://placeholder:placeholder@localhost:5432/placeholder",
      BETTER_AUTH_SECRET: "placeholder-secret-for-build-validation",
    },
    ciDeployVars: [],
    ciDeploySecrets: [
      "CLOUDFLARE_API_TOKEN",
      "CLOUDFLARE_ACCOUNT_ID",
      "DATABASE_URL",
      "BETTER_AUTH_SECRET",
    ],
    cursorRulesToDelete: [".cursor/rules/backend.mdc", ".cursor/rules/frontend.mdc"],
  },
  "fullstack-tanstack-elysia": {
    label: "Fullstack with Elysia (apps/fullstack-tanstack-elysia)",
    keep: ["apps/fullstack-tanstack-elysia"],
    remove: ["apps/web", "apps/server", "apps/fullstack-fn-only"],
    scriptsRemove: ["dev:web", "dev:server", "dev:fullstack-fn"],
    catalogRemove: ["@elysiajs/cors"],
    envSchemasRemove: ["serverEnvSchema", "webServerEnvSchema", "webClientEnvSchema"],
    envFilesToDelete: [
      "packages/infra-env/src/server.ts",
      "packages/infra-env/src/web-server.ts",
      "packages/infra-env/src/web-client.ts",
    ],
    dbEnvSource: "apps/fullstack-tanstack-elysia/.env",
    ciAppDir: "apps/fullstack-tanstack-elysia",
    ciNeedsBackend: false,
    ciBuildEnv: {
      DATABASE_URL: "postgresql://placeholder:placeholder@localhost:5432/placeholder",
      BETTER_AUTH_SECRET: "placeholder-secret-for-build-validation",
    },
    ciDeployVars: [],
    ciDeploySecrets: [
      "CLOUDFLARE_API_TOKEN",
      "CLOUDFLARE_ACCOUNT_ID",
      "DATABASE_URL",
      "BETTER_AUTH_SECRET",
    ],
    cursorRulesToDelete: [".cursor/rules/backend.mdc"],
  },
};

// ---------------------------------------------------------------------------
// Env schema -> file mapping
// ---------------------------------------------------------------------------

const ENV_SCHEMA_MAP: Record<string, { exportLine: string; file: string }> = {
  fullstackServerEnvSchema: {
    exportLine: 'export { fullstackServerEnvSchema } from "./fullstack-server";',
    file: "packages/infra-env/src/fullstack-server.ts",
  },
  serverEnvSchema: {
    exportLine: 'export { serverEnvSchema } from "./server";',
    file: "packages/infra-env/src/server.ts",
  },
  webClientEnvSchema: {
    exportLine: 'export { webClientEnvSchema } from "./web-client";',
    file: "packages/infra-env/src/web-client.ts",
  },
  webServerEnvSchema: {
    exportLine: 'export { webServerEnvSchema } from "./web-server";',
    file: "packages/infra-env/src/web-server.ts",
  },
};

const CONVEX_SKILLS = [
  ".claude/skills/convex",
  ".claude/skills/convex-agents",
  ".claude/skills/convex-best-practices",
  ".claude/skills/convex-component-authoring",
  ".claude/skills/convex-cron-jobs",
  ".claude/skills/convex-file-storage",
  ".claude/skills/convex-functions",
  ".claude/skills/convex-http-actions",
  ".claude/skills/convex-migrations",
  ".claude/skills/convex-realtime",
  ".claude/skills/convex-schema-validator",
  ".claude/skills/convex-security-audit",
  ".claude/skills/convex-security-check",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function abs(rel: string): string {
  return path.join(ROOT, rel);
}

function removeDir(rel: string): boolean {
  const full = abs(rel);
  if (existsSync(full)) {
    rmSync(full, { recursive: true, force: true });
    return true;
  }
  return false;
}

function removeFile(rel: string): boolean {
  const full = abs(rel);
  if (existsSync(full)) {
    rmSync(full, { force: true });
    return true;
  }
  return false;
}

function readJson(rel: string): any {
  return JSON.parse(readFileSync(abs(rel), "utf-8"));
}

function writeJson(rel: string, data: any): void {
  writeFileSync(abs(rel), JSON.stringify(data, null, 2) + "\n");
}

function choose(question: string, options: string[]): number {
  console.log(`\n${question}\n`);
  for (let i = 0; i < options.length; i++) {
    console.log(`  ${i + 1}) ${options[i]}`);
  }
  console.log();

  while (true) {
    const answer = prompt(`  Choice (1-${options.length}):`);
    if (!answer) continue;
    const idx = parseInt(answer.trim()) - 1;
    if (idx >= 0 && idx < options.length) return idx;
    console.log(`  Please enter 1-${options.length}`);
  }
}

function yesNo(question: string): boolean {
  while (true) {
    const answer = prompt(`${question} (y/n):`);
    if (!answer) continue;
    const lower = answer.trim().toLowerCase();
    if (lower === "y" || lower === "yes") return true;
    if (lower === "n" || lower === "no") return false;
    console.log("  Please enter y or n");
  }
}

async function run(cmd: string[], opts?: { silent?: boolean }): Promise<number> {
  const proc = Bun.spawn(cmd, {
    cwd: ROOT,
    stdout: opts?.silent ? "ignore" : "inherit",
    stderr: opts?.silent ? "ignore" : "inherit",
  });
  return proc.exited;
}

// ---------------------------------------------------------------------------
// CI/CD Template Generators
// ---------------------------------------------------------------------------

function generatePrValidation(config: PatternConfig, scope: string): string {
  const envLines = Object.entries(config.ciBuildEnv)
    .map(([k, v]) => `          ${k}: ${v}`)
    .join("\n");

  let backendStep = "";
  if (config.ciNeedsBackend) {
    backendStep = `
      - name: Build backend
        working-directory: apps/server
        run: bun run build
`;
  }

  return `name: PR Validation

on:
  pull_request:
    branches:
      - main

concurrency:
  group: \${{ github.workflow }}-\${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  validate:
    name: Validate PR
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.4

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Lint
        run: bun run lint

      - name: Check formatting
        run: bunx oxfmt --check .

      - name: Build packages
        run: bun run build --filter='${scope}/*'

      - name: Type check
        run: bun run check-types

      - name: Build app
        working-directory: ${config.ciAppDir}
        env:
${envLines}
        run: bun run build
${backendStep}`;
}

function generateDeployProduction(config: PatternConfig, scope: string): string {
  // Build env uses secrets/vars references
  const buildEnvLines = Object.keys(config.ciBuildEnv)
    .map((k) => {
      if (config.ciDeployVars.includes(k)) return `          ${k}: \${{ vars.${k} }}`;
      return `          ${k}: \${{ secrets.${k} }}`;
    })
    .join("\n");

  // Deploy secrets list (for wrangler-action)
  const allDeploySecrets = [...config.ciDeployVars, ...config.ciDeploySecrets];
  const deploySecretsList = allDeploySecrets.map((s) => `            ${s}`).join("\n");

  // Deploy env vars
  const deployEnvEntries = [
    "          ENVIRONMENT: production",
    ...config.ciDeployVars.map((v) => `          ${v}: \${{ vars.${v} }}`),
    ...config.ciDeploySecrets.map((s) => `          ${s}: \${{ secrets.${s} }}`),
  ];
  const deployEnvLines = deployEnvEntries.join("\n");

  let backendStep = "";
  if (config.ciNeedsBackend) {
    backendStep = `
      - name: Deploy Backend to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3.14.1
        with:
          apiToken: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: apps/server
          secrets: |
            DATABASE_URL
            DATABASE_URL_DIRECT
            BETTER_AUTH_SECRET
            CORS_ORIGIN
        env:
          DATABASE_URL: \${{ secrets.DATABASE_URL }}
          DATABASE_URL_DIRECT: \${{ secrets.DATABASE_URL_DIRECT }}
          CORS_ORIGIN: \${{ vars.CORS_ORIGIN }}
          BETTER_AUTH_SECRET: \${{ secrets.BETTER_AUTH_SECRET }}
`;
  }

  return `name: Deploy to Production

on:
  push:
    branches:
      - production

jobs:
  deploy-production:
    name: Deploy to production
    runs-on: ubuntu-latest
    environment: production

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: 1.3.4

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Install Wrangler
        run: bun add -g wrangler

      - name: Build packages only
        run: bun run build --filter='${scope}/*'

      - name: Build app
        working-directory: ${config.ciAppDir}
        env:
${buildEnvLines}
        run: bun run build

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3.14.1
        with:
          apiToken: \${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: \${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: ${config.ciAppDir}
          secrets: |
${deploySecretsList}
        env:
${deployEnvLines}
${backendStep}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("\n=== Monorepo Template Customizer ===\n");
  console.log("This will strip the template to your chosen architecture pattern,");
  console.log("remove features you don't need, and rename the project scope.");

  // --- Gather choices ---

  const patternIdx = choose("Which web architecture pattern?", [
    "Client-Server -- Separate frontend (apps/web) + API backend (apps/server)",
    "Fullstack serverFn only -- Single app using TanStack Start server functions",
    "Fullstack with Elysia -- Single app with Elysia API embedded in TanStack Start",
  ]);
  const patternKeys: Pattern[] = [
    "client-server",
    "fullstack-fn-only",
    "fullstack-tanstack-elysia",
  ];
  const pattern = patternKeys[patternIdx];
  const config = PATTERNS[pattern];

  const keepMobile = yesNo("\nKeep mobile app (Expo + React Native)?");
  const keepDocs = yesNo("Keep documentation site (Fumadocs + Next.js)?");
  const keepConvex = yesNo("Keep Convex skills (for future integration)?");

  console.log('\nProject name (kebab-case, e.g. "my-app").');
  console.log("This replaces @monorepo-template scope everywhere.");
  const rawName = prompt("  Name (or press Enter to skip):") || null;
  const projectName = rawName?.replace(/^@/, "").trim() || null;

  const scope = projectName ? `@${projectName}` : "@monorepo-template";

  // --- Confirm ---

  const toDelete = [...config.remove];
  if (!keepMobile) toDelete.push("apps/mobile");
  if (!keepDocs) toDelete.push("apps/fumadocs");

  const toKeep = [
    ...config.keep,
    ...(keepMobile ? ["apps/mobile"] : []),
    ...(keepDocs ? ["apps/fumadocs"] : []),
  ];

  console.log("\n" + "=".repeat(50));
  console.log("  CUSTOMIZATION PLAN");
  console.log("=".repeat(50));
  console.log(`\n  Pattern:  ${config.label}`);
  console.log(`  Mobile:   ${keepMobile ? "keep" : "remove"}`);
  console.log(`  Docs:     ${keepDocs ? "keep" : "remove"}`);
  console.log(`  Convex:   ${keepConvex ? "keep" : "remove"}`);
  console.log(`  Scope:    ${projectName ? `@monorepo-template -> ${scope}` : "no rename"}`);
  console.log(`\n  DELETE: ${toDelete.join(", ")}`);
  console.log(`  KEEP:   ${toKeep.join(", ")}`);

  if (!yesNo("\nProceed?")) {
    console.log("Aborted.");
    process.exit(0);
  }

  console.log("\n" + "=".repeat(50));
  console.log("  EXECUTING");
  console.log("=".repeat(50));

  // --- Step 1: Delete app directories ---

  console.log("\n[1/9] Deleting app directories...");
  for (const dir of toDelete) {
    if (removeDir(dir)) console.log(`  Deleted ${dir}/`);
  }

  // --- Step 2: Delete Convex skills ---

  if (!keepConvex) {
    console.log("\n[2/9] Removing Convex skills...");
    let count = 0;
    for (const dir of CONVEX_SKILLS) {
      if (removeDir(dir)) count++;
    }
    console.log(`  Removed ${count} Convex skill directories`);
  } else {
    console.log("\n[2/9] Keeping Convex skills.");
  }

  // --- Step 3: Clean .cursor rules ---

  console.log("\n[3/9] Cleaning up .cursor rules...");
  for (const file of config.cursorRulesToDelete) {
    if (removeFile(file)) console.log(`  Deleted ${file}`);
  }
  if (!keepDocs) {
    if (removeFile(".cursor/rules/documentation.mdc"))
      console.log("  Deleted .cursor/rules/documentation.mdc");
  }

  // --- Step 4: Update root package.json ---

  console.log("\n[4/9] Updating root package.json...");
  const pkg = readJson("package.json");

  // Remove scripts for deleted apps
  const scriptsToRemove = [...config.scriptsRemove];
  if (!keepMobile) scriptsToRemove.push("dev:native");
  for (const script of scriptsToRemove) {
    if (pkg.scripts?.[script]) {
      delete pkg.scripts[script];
      console.log(`  Removed script: ${script}`);
    }
  }

  // Update db:* env source path
  for (const key of ["db:push", "db:studio", "db:generate", "db:migrate"]) {
    if (pkg.scripts?.[key]) {
      pkg.scripts[key] = pkg.scripts[key].replace(/apps\/[^/]+\/.env/, config.dbEnvSource);
    }
  }
  console.log(`  Updated db:* scripts -> ${config.dbEnvSource}`);

  // Remove catalog entries
  const catalogToRemove = [...config.catalogRemove];
  if (!keepMobile) catalogToRemove.push("@better-auth/expo");
  for (const entry of catalogToRemove) {
    if (pkg.workspaces?.catalog?.[entry]) {
      delete pkg.workspaces.catalog[entry];
      console.log(`  Removed catalog: ${entry}`);
    }
  }

  // Remove the customize/rename scripts (they'll be cleaned up later)
  delete pkg.scripts?.["customize"];
  delete pkg.scripts?.["rename"];

  writeJson("package.json", pkg);

  // --- Step 5: Clean up infra-env ---

  console.log("\n[5/9] Cleaning up infra-env schemas...");
  for (const schema of config.envSchemasRemove) {
    const info = ENV_SCHEMA_MAP[schema];
    if (info && removeFile(info.file)) {
      console.log(`  Deleted ${info.file}`);
    }
  }

  // Regenerate index.ts with only the kept exports
  const keepExports = ['export { commaSeparatedList } from "./transforms";'];
  for (const [schemaName, info] of Object.entries(ENV_SCHEMA_MAP)) {
    if (!config.envSchemasRemove.includes(schemaName)) {
      keepExports.push(info.exportLine);
    }
  }
  writeFileSync(abs("packages/infra-env/src/index.ts"), keepExports.join("\n") + "\n");
  console.log("  Updated packages/infra-env/src/index.ts");

  // --- Step 6: Generate CI/CD workflows ---

  console.log("\n[6/9] Generating CI/CD workflows...");
  writeFileSync(abs(".github/workflows/pr-validation.yml"), generatePrValidation(config, scope));
  console.log("  Generated .github/workflows/pr-validation.yml");
  writeFileSync(
    abs(".github/workflows/deploy-production.yml"),
    generateDeployProduction(config, scope),
  );
  console.log("  Generated .github/workflows/deploy-production.yml");

  // --- Step 7: Clean lint configs ---

  console.log("\n[7/9] Cleaning up lint configs...");
  for (const configFile of [".oxlintrc.json", ".oxfmtrc.json"]) {
    const full = abs(configFile);
    if (!existsSync(full)) continue;

    try {
      const data = readJson(configFile);
      if (data.ignorePatterns) {
        data.ignorePatterns = data.ignorePatterns.filter((p: string) => {
          // Remove app-specific routeTree path (glob patterns already catch it)
          if (p === "apps/web/src/routeTree.gen.ts") return false;
          // Remove Next.js patterns if no docs
          if (!keepDocs && p === "**/.next/**") return false;
          if (!keepDocs && p === "**/.source/**") return false;
          return true;
        });
        writeJson(configFile, data);
        console.log(`  Cleaned ${configFile}`);
      }
    } catch {
      // Not valid JSON or no ignorePatterns — skip
    }
  }

  // --- Step 8: Remove customize files ---

  console.log("\n[8/9] Removing customization files...");
  removeDir(".claude/skills/customize-template");
  removeFile(".claude/commands/customize-template.md");
  console.log("  Removed .claude/skills/customize-template/");
  console.log("  Removed .claude/commands/customize-template.md");

  // --- Step 9: Rename + Install + Verify ---

  if (projectName) {
    console.log(`\n[9/9] Renaming @monorepo-template -> ${scope}...`);
    await run(["bun", "run", abs("scripts/rename.ts"), projectName, "--skip-install"]);
  } else {
    console.log("\n[9/9] Skipping rename.");
  }

  // Clean up scripts
  removeFile("scripts/rename.ts");
  removeFile("scripts/customize.ts");
  try {
    const files = readdirSync(abs("scripts"));
    if (files.length === 0) removeDir("scripts");
  } catch {
    // directory doesn't exist
  }

  // Install dependencies
  console.log("\nInstalling dependencies...");
  await run(["bun", "install"]);

  // Verify
  console.log("\nVerifying build...");
  const buildCode = await run(["bun", "run", "build"]);

  console.log("\nType checking...");
  const typesCode = await run(["bun", "run", "check-types"]);

  // --- Summary ---

  console.log("\n" + "=".repeat(50));
  console.log("  DONE");
  console.log("=".repeat(50));
  console.log(`\n  Pattern:  ${config.label}`);
  console.log(`  Scope:    ${scope}`);
  console.log(`  Build:    ${buildCode === 0 ? "PASS" : "FAIL (check errors above)"}`);
  console.log(`  Types:    ${typesCode === 0 ? "PASS" : "FAIL (check errors above)"}`);

  console.log("\n  Remaining manual steps:");
  console.log("  - Update CLAUDE.md if needed (architecture examples)");
  console.log("  - Update .cursorrules if needed (workspace structure section)");
  console.log("  - Update .claude/architecture.md if it references deleted apps");
  console.log("  - Review .claude/todo-crud-reference.md");
  console.log("  - Commit the changes");

  console.log("\n  Run 'bun run dev' to start developing!\n");
}

main();
