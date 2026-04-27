import { describe, expect, it } from "vitest";

import { normalizeTeamLabel, resolveMatchTeamLabels } from "@/lib/team-labels";

describe("team label helpers", () => {
  it("normaliza nombres vacios como null", () => {
    expect(normalizeTeamLabel("  ")).toBeNull();
    expect(normalizeTeamLabel(null)).toBeNull();
    expect(normalizeTeamLabel("  Los Pibes  ")).toBe("Los Pibes");
  });

  it("usa Negro y Blanco como fallback", () => {
    expect(resolveMatchTeamLabels({ team_a_label: null, team_b_label: "" })).toEqual({
      teamA: "Negro",
      teamB: "Blanco"
    });
  });

  it("respeta etiquetas guardadas en el partido", () => {
    expect(resolveMatchTeamLabels({ team_a_label: "Los Pibes", team_b_label: "La Banda" })).toEqual({
      teamA: "Los Pibes",
      teamB: "La Banda"
    });
  });
});

