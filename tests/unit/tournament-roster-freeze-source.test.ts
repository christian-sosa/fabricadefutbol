import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function countOccurrences(source: string, needle: string) {
  return source.split(needle).length - 1;
}

describe("tournament roster freeze guards", () => {
  it("bloquea mutaciones admin de inscriptos, capitanes y planteles cerrados", () => {
    const source = readFileSync(
      path.join(
        root,
        "src",
        "app",
        "admin",
        "(panel)",
        "tournaments",
        "[id]",
        "competitions",
        "[competitionId]",
        "actions.ts"
      ),
      "utf8"
    );

    expect(source).toContain("assertCompetitionRosterEditableAction");
    expect(countOccurrences(source, "await assertCompetitionRosterEditableAction(competitionId);")).toBeGreaterThanOrEqual(8);
  });

  it("bloquea mutaciones de capitanes sobre planteles cerrados", () => {
    const source = readFileSync(path.join(root, "src", "app", "captain", "actions.ts"), "utf8");

    expect(source).toContain("assertCompetitionRosterEditableAction");
    expect(countOccurrences(source, "await assertCompetitionRosterEditableAction(parsed.data.competitionId);")).toBe(4);
  });
});
