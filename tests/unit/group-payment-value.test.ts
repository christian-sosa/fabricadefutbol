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
    expect(state.headline).toBe("Tu grupo ya tiene valor acumulado");
    expect(state.description).not.toMatch(/trial|prueba|plan|pago|reactivar/i);
  });

  it.each<[GroupActivityValueInput, string]>([
    [{ playersCount: 10, totalMatches: 0, finishedCount: 0 }, "first_match"],
    [{ playersCount: 0, totalMatches: 1, finishedCount: 0 }, "first_match"]
  ])("marca primeros partidos cuando hay carga inicial", (input, expectedStage) => {
    const state = buildGroupActivityValueState(input);

    expect(state.stage).toBe(expectedStage);
  });
});
