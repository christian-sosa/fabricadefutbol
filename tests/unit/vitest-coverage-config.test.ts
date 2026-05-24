import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const configPath = path.join(root, "vitest.config.mts");

function extractTrackedSourcePaths(source: string) {
  return Array.from(source.matchAll(/"((?:src|tests)\/[^"]+)"/g), ([, relativePath]) => relativePath)
    .filter((relativePath): relativePath is string => Boolean(relativePath))
    .filter((relativePath) => relativePath.endsWith(".ts") || relativePath.endsWith(".tsx"));
}

describe("vitest coverage config", () => {
  it("tracks only source files that exist", () => {
    const source = readFileSync(configPath, "utf8");
    const missingFiles = extractTrackedSourcePaths(source)
      .filter((relativePath) => relativePath.startsWith("src/"))
      .filter((relativePath) => !existsSync(path.join(root, relativePath)));

    expect(missingFiles).toEqual([]);
  });
});
