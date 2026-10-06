import { readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Convex bundles every file under convex/ (except _generated/), helper dirs
// included, and rejects any path component outside [A-Za-z0-9_.] at deploy
// time. Nothing else in the toolchain catches it, so this test does.
const convexDir = join(dirname(fileURLToPath(import.meta.url)), "..", "convex");
const VALID_COMPONENT = /^[A-Za-z0-9_.]+$/;

function collectPaths(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "_generated") return [];
    const full = join(dir, entry.name);
    return entry.isDirectory() ? [full, ...collectPaths(full)] : [full];
  });
}

describe("convex module paths", () => {
  it("only uses alphanumeric characters, underscores and periods in file and directory names", () => {
    const offenders = collectPaths(convexDir).filter(
      (path) => !VALID_COMPONENT.test(path.split(/[\\/]/).pop() ?? ""),
    );
    const message = offenders
      .map(
        (path) =>
          `Invalid Convex module path '${relative(convexDir, path)}': Convex rejects any path component outside [A-Za-z0-9_.] when pushing the deployment, so rename it to camelCase.`,
      )
      .join("\n");
    expect(offenders, message).toEqual([]);
  });
});
