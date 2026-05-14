import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const adminLandingPath = path.join(root, "src", "app", "admin", "(panel)", "page.tsx");
const clubDetailPath = path.join(root, "src", "app", "admin", "(panel)", "clubs", "[clubId]", "page.tsx");
const leagueDetailPath = path.join(root, "src", "app", "admin", "(panel)", "tournaments", "[id]", "page.tsx");

describe("admin space media UX source", () => {
  it("mantiene previews visibles y esconde la carga de imagenes detras de botones", () => {
    const adminLandingSource = readFileSync(adminLandingPath, "utf8");
    const clubDetailSource = readFileSync(clubDetailPath, "utf8");
    const leagueDetailSource = readFileSync(leagueDetailPath, "utf8");

    expect(adminLandingSource).toContain("Cambiar imagen");
    expect(adminLandingSource).toContain("Identidad publica");
    expect(adminLandingSource).toContain("Foto de portada");
    expect(adminLandingSource).not.toContain("Escudo del grupo");
    expect(adminLandingSource).not.toContain("logo separado");
    expect(adminLandingSource).toContain("<summary className=\"mt-4 flex w-fit cursor-pointer");
    expect(clubDetailSource).toContain("Cambiar escudo");
    expect(clubDetailSource).toContain("<summary className=\"inline-flex w-fit cursor-pointer");
    expect(leagueDetailSource).toContain("Cambiar logo");
    expect(leagueDetailSource).toContain("Cambiar foto");
    expect(leagueDetailSource).toContain("<summary className=\"inline-flex w-fit cursor-pointer");
  });
});
