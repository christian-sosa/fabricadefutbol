import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const adminPagePath = path.join(root, "src", "app", "admin", "(panel)", "page.tsx");
const newGroupPagePath = path.join(root, "src", "app", "admin", "(panel)", "new", "page.tsx");
const actionsPath = path.join(root, "src", "app", "admin", "(panel)", "actions.ts");
const hasFiles = [adminPagePath, newGroupPagePath, actionsPath].every(existsSync);
const describeAdminFiles = hasFiles ? describe : describe.skip;

describeAdminFiles("admin annual season controls", () => {
  it("no expone controles ni parametros para cambiar el cierre anual de temporada", () => {
    const combinedSource = [adminPagePath, newGroupPagePath, actionsPath]
      .map((filePath) => readFileSync(filePath, "utf8"))
      .join("\n");

    expect(combinedSource).not.toContain("seasonEndsAt");
    expect(combinedSource).not.toContain("Fin de temporada");
    expect(combinedSource).not.toContain("Termina el");
  });
});
