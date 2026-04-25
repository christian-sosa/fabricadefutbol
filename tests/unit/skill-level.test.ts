import { describe, expect, it } from "vitest";

import {
  calculateEffectiveSkillLevel,
  calculateEffectiveSkillScore,
  mapInitialRankToSkillLevel,
  normalizeSkillLevel
} from "@/lib/domain/skill-level";

describe("skill level helpers", () => {
  it("mapea ranks 1..21 a 5 niveles con distribucion ntile", () => {
    const levels = Array.from({ length: 21 }, (_, index) =>
      mapInitialRankToSkillLevel({
        initialRank: index + 1,
        totalPlayers: 21
      })
    );

    expect(levels.slice(0, 5)).toEqual([1, 1, 1, 1, 1]);
    expect(levels.slice(5, 9)).toEqual([2, 2, 2, 2]);
    expect(levels.slice(9, 13)).toEqual([3, 3, 3, 3]);
    expect(levels.slice(13, 17)).toEqual([4, 4, 4, 4]);
    expect(levels.slice(17, 21)).toEqual([5, 5, 5, 5]);
  });

  it("calcula nivel efectivo con umbrales de rating", () => {
    expect(calculateEffectiveSkillLevel({ skillLevel: 2, currentRating: 1050 })).toBe(1);
    expect(calculateEffectiveSkillLevel({ skillLevel: 2, currentRating: 1049 })).toBe(2);
    expect(calculateEffectiveSkillLevel({ skillLevel: 4, currentRating: 951 })).toBe(4);
    expect(calculateEffectiveSkillLevel({ skillLevel: 4, currentRating: 950 })).toBe(5);
  });

  it("aplica bonus y penalizacion de borde sin salir de 1..5", () => {
    expect(calculateEffectiveSkillScore({ skillLevel: 2, currentRating: 1060 })).toBe(500);
    expect(calculateEffectiveSkillScore({ skillLevel: 1, currentRating: 1080 })).toBe(525);
    expect(calculateEffectiveSkillScore({ skillLevel: 4, currentRating: 940 })).toBe(100);
    expect(calculateEffectiveSkillScore({ skillLevel: 5, currentRating: 930 })).toBe(75);
  });

  it("normaliza valores invalidos a un nivel seguro", () => {
    expect(normalizeSkillLevel(0)).toBe(1);
    expect(normalizeSkillLevel(9)).toBe(5);
    expect(normalizeSkillLevel(Number.NaN)).toBe(5);
  });
});
