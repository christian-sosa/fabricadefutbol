import { describe, expect, it } from "vitest";

import {
  buildGroupActivityValueState,
  type GroupActivityValueInput
} from "@/lib/group-activity-value";

describe("group activity value helpers", () => {
  it("marca como primeros pasos cuando aun no hay jugadores", () => {
    expect(
      buildGroupActivityValueState({
        playersCount: 0,
        totalMatches: 0,
        finishedCount: 0
      }).stage
    ).toBe("setup");
  });

  it("marca valor probado cuando ya hay resultados cargados", () => {
    const state = buildGroupActivityValueState({
      playersCount: 16,
      totalMatches: 5,
      finishedCount: 3
    });

    expect(state.stage).toBe("proven");
    expect(state.headline).toBe("Estado del grupo");
    expect(state.description).toMatch(/Faltan 2 resultados/i);
    expect(state.pendingResultsCount).toBe(2);
    expect(state.description).not.toMatch(/trial|prueba|plan|pago|reactivar/i);
  });

  it("marca el grupo al dia cuando todos los partidos tienen resultado", () => {
    const state = buildGroupActivityValueState({
      playersCount: 21,
      totalMatches: 10,
      finishedCount: 10
    });

    expect(state.headline).toBe("Estado del grupo");
    expect(state.description).toMatch(/Todo al dia/i);
    expect(state.pendingResultsCount).toBe(0);
  });

  it.each<[GroupActivityValueInput, string]>([
    [{ playersCount: 10, totalMatches: 0, finishedCount: 0 }, "first_match"],
    [{ playersCount: 0, totalMatches: 1, finishedCount: 0 }, "first_match"]
  ])("marca primeros partidos cuando hay carga inicial", (input, expectedStage) => {
    const state = buildGroupActivityValueState(input);

    expect(state.stage).toBe(expectedStage);
  });
});
