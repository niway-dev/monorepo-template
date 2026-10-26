#!/usr/bin/env bun
/**
 * Write every app's local env file from the configured secrets provider.
 *
 *   bun run env:pull                         # default environment (dev)
 *   bun run env:pull -- --env staging        # another environment slug
 *   ENV_PROVIDER=<name> bun run env:pull     # another provider from ./providers
 *
 * The one moment local development talks to the provider: `bun dev` and the db:* scripts
 * read the files written here, so a provider outage blocks a refresh, never a session.
 * What is written lives in ./config.ts; how values are fetched lives in ./providers.
 *
 * All or nothing: every target is fetched and checked first; files are replaced only if
 * all succeed. Files are owner-only (0600). Never prints a value.
 */
import { existsSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { envConfig, type EnvTarget } from "./config";
import { providers } from "./providers";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

let environment = envConfig.environment;
const argv = Bun.argv.slice(2);
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === "--env" && argv[i + 1]) {
    environment = argv[++i];
  } else if (arg === "-h" || arg === "--help") {
    console.log(
      "usage: bun run env:pull [-- --env <slug>]   (ENV_PROVIDER=<name> to switch provider)",
    );
    process.exit(0);
  } else {
    fail(`unexpected argument ${arg}`);
  }
}

const providerName = process.env.ENV_PROVIDER || envConfig.provider;
const makeProvider = providers[providerName];
if (!makeProvider) {
  fail(`unknown provider "${providerName}". Known: ${Object.keys(providers).join(", ")}`);
}
const provider = makeProvider(ROOT);

// Apps removed by `bun run customize` simply have no directory.
const targets = envConfig.targets.filter((t) => existsSync(join(ROOT, dirname(t.file))));
if (targets.length === 0) fail("no target's app directory exists; check scripts/env/config.ts");

await attempt(() => provider.check());
console.log(`Pulling env "${environment}" from ${provider.name}`);

// Fetch each consumer once, even when several targets share it.
const byConsumer = new Map<string, Record<string, string>>();
const staged: { target: EnvTarget; content: string }[] = [];

for (const target of targets) {
  process.stdout.write(`  ${target.file.padEnd(36)}`);
  let values = byConsumer.get(target.consumer);
  if (!values) {
    values = await attempt(() => provider.fetch({ environment, consumer: target.consumer }), true);
    byConsumer.set(target.consumer, values);
  }
  const all = values;
  const keys = Object.keys(all)
    .filter((k) => !target.keep || target.keep.test(k))
    .sort();
  const missing = target.required.filter((k) => !keys.includes(k));
  if (missing.length > 0) {
    console.log("");
    fail(
      `missing for ${target.file} in env "${environment}": ${missing.join(" ")}.\n` +
        `       Create them and give them the consumer "${target.consumer}" (Infisical: a tag).\n` +
        "       An untagged key is silently absent, not an error.",
    );
  }
  staged.push({ target, content: keys.map((k) => `${k}=${quote(k, all[k])}`).join("\n") + "\n" });
  console.log(`${keys.length} variables`);
}

// Every target passed: only now replace the real files, each through a temp name so a
// reader never sees a half-written file.
for (const { target, content } of staged) {
  const path = join(ROOT, target.file);
  const tmp = `${path}.tmp.${process.pid}`;
  writeFileSync(tmp, content, { mode: 0o600 });
  renameSync(tmp, path);
}
console.log(
  `\nWrote ${staged.length} env files (${environment}). Do not edit them by hand; re-run this command.`,
);

/** dotenv quoting that Wrangler, Vite and Expo all read the same way. Never echoes the value. */
function quote(key: string, value: string): string {
  if (/^[\w.:/@,+=-]*$/.test(value)) return value;
  if (!value.includes("'") && !value.includes("\n")) return `'${value}'`;
  if (!value.includes('"')) return `"${value.replace(/\n/g, "\\n")}"`;
  fail(`${key} mixes quotes and newlines in a way a dotenv file cannot carry; simplify the value.`);
}

async function attempt<T>(run: () => Promise<T>, midLine = false): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (midLine) console.log("");
    fail(error instanceof Error ? error.message : String(error));
  }
}

function fail(text: string): never {
  console.error(`\nerror: ${text}\n       Existing env files were left untouched.`);
  process.exit(1);
}
