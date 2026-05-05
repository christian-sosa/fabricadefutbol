import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const sourceDirs = ["src/app", "src/components"].map((dir) => path.join(root, dir));

function listSourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir).flatMap((entry) => {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) return listSourceFiles(fullPath);
    return /\.(tsx|ts)$/.test(entry) ? [fullPath] : [];
  });
}

describe("server action forms", () => {
  it("no declaran method ni encType cuando action es una funcion", () => {
    const invalidForms = listSourceFiles(sourceDirs[0])
      .concat(listSourceFiles(sourceDirs[1]))
      .flatMap((filePath) => {
        const source = readFileSync(filePath, "utf8");
        const matches = source.matchAll(/<form\b(?=[^>]*\baction=\{)(?=[^>]*\b(?:encType|method)=)[^>]*>/g);
        return Array.from(matches, () => path.relative(root, filePath));
      });

    expect(Array.from(new Set(invalidForms))).toEqual([]);
  });
});
