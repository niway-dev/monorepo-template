import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProviderError, type EnvProvider } from "./types";

/**
 * Infisical: folders group values by risk, tags name the consumer
 * (hub: infra/infisical-secrets.md). The CLI's export command has no `--recursive`, so
 * every folder that can hold a consumer's values is listed here and read one by one. A
 * folder created in Infisical but missing here makes its keys silently absent; the
 * required-key check in pull.ts is what turns that into an error.
 */
const FOLDERS = ["/public", "/database", "/auth"];
const PLACEHOLDER = "REPLACE_WITH_INFISICAL_PROJECT_ID";
const ATTEMPTS = 3;

export function infisicalProvider(root: string): EnvProvider {
  return {
    name: "infisical",

    async check() {
      if (!Bun.which("infisical")) {
        throw new ProviderError(
          "the Infisical CLI is not installed.\n" +
            "       macOS: brew install infisical/get-cli/infisical, then: infisical login",
        );
      }
      const config = join(root, ".infisical.json");
      if (!existsSync(config) || readFileSync(config, "utf8").includes(PLACEHOLDER)) {
        throw new ProviderError(
          ".infisical.json does not link a project yet.\n" +
            "       Run `infisical init` at the repo root (or paste the Project ID into .infisical.json) and commit it.",
        );
      }
    },

    async fetch({ environment, consumer }) {
      // Values go to a private temp file, never through stdout.
      const dir = mkdtempSync(join(tmpdir(), "env-pull-"));
      const out = join(dir, "values.json");
      const values: Record<string, string> = {};
      try {
        for (const path of FOLDERS) {
          const failure = await readFolder({ environment, consumer, path, out });
          if (failure !== null) {
            throw new ProviderError(
              `could not read ${path} (tag "${consumer}", env "${environment}").\n` +
                `       Check: infisical login, access to this project, and that env "${environment}" exists.\n` +
                `       infisical said: ${failure.trim() || "(no output)"}`,
            );
          }
          const raw = existsSync(out) ? readFileSync(out, "utf8").trim() : "";
          const entries = (raw ? JSON.parse(raw) : []) as { key: string; value: string }[];
          for (const { key, value } of entries) {
            if (key in values) {
              throw new ProviderError(
                `"${key}" exists in more than one folder for tag "${consumer}"; one would shadow the other.`,
              );
            }
            values[key] = value;
          }
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
      return values;
    },
  };

  /** Writes one folder's values to `out`. Returns null on success, else the CLI's stderr. */
  async function readFolder(o: {
    environment: string;
    consumer: string;
    path: string;
    out: string;
  }): Promise<string | null> {
    let stderr = "";
    // Infisical drops requests intermittently, so a failed call is retried briefly.
    for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
      rmSync(o.out, { force: true });
      const proc = Bun.spawn(
        [
          "infisical",
          "export",
          `--env=${o.environment}`,
          `--path=${o.path}`,
          "--tags",
          o.consumer,
          "--format=json",
          "--silent",
          `--output-file=${o.out}`,
        ],
        { cwd: root, stdin: "ignore", stdout: "ignore", stderr: "pipe" },
      );
      stderr = await new Response(proc.stderr).text();
      if ((await proc.exited) === 0) return null;
      if (attempt < ATTEMPTS) await Bun.sleep(attempt * 1000);
    }
    return stderr;
  }
}
