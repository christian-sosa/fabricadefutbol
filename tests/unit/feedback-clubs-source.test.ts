import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function readSource(...segments: string[]) {
  return readFileSync(path.join(root, ...segments), "utf8");
}

describe("contacto para clubes", () => {
  it("permite que alguien escriba para traer un club o equipo", () => {
    const pageSource = readSource("src", "app", "feedback", "page.tsx");
    const actionsSource = readSource("src", "app", "feedback", "actions.ts");
    const emailSource = readSource("src", "lib", "feedback-email.ts");

    expect(pageSource).toContain("intent?: string");
    expect(pageSource).toContain("isClubInquiry");
    expect(pageSource).toContain("Traer un club o equipo");
    expect(pageSource).toContain('<option value="clubs">Clubes / equipos</option>');
    expect(actionsSource).toContain('"clubs"');
    expect(actionsSource).toContain("defaultIntent");
    expect(emailSource).toContain('case "clubs"');
    expect(emailSource).toContain("Clubes");
  });
});
