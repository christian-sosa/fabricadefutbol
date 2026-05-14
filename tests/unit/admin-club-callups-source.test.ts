import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();
const clubDetailPath = path.join(root, "src", "app", "admin", "(panel)", "clubs", "[clubId]", "page.tsx");
const clubActionsPath = path.join(root, "src", "app", "admin", "(panel)", "clubs", "[clubId]", "actions.ts");
const publicClubPath = path.join(root, "src", "app", "clubs", "[slug]", "page.tsx");

describe("admin club callups source", () => {
  it("agrega convocatoria solo al admin privado de clubs", () => {
    const adminSource = readFileSync(clubDetailPath, "utf8");
    const actionsSource = readFileSync(clubActionsPath, "utf8");
    const publicSource = readFileSync(publicClubPath, "utf8");

    expect(adminSource).toContain('key: "callups", label: "Convocatoria"');
    expect(adminSource).toContain("function CallupsTab");
    expect(adminSource).toContain("buildClubCallupSummary");
    expect(actionsSource).toContain("addClubCallupAction");
    expect(actionsSource).toContain("updateClubCallupPlayerAction");
    expect(actionsSource).toContain("addClubCallupGuestAction");
    expect(actionsSource).toContain("club_callups");
    expect(actionsSource).toContain("club_callup_players");
    expect(actionsSource).toContain("club_callup_guests");
    expect(adminSource).toContain("Buscar por nombre");
    expect(adminSource).toContain("Agregar invitado");
    expect(publicSource).not.toContain("Convocatoria");
    expect(publicSource).not.toContain("club_callups");
  });
});
