import { describe, expect, it } from "vitest";
import { parsePlayerNameList } from "@/lib/domain/player-name-list";

describe("lista rápida de jugadores", () => {
  it("admite una convocatoria numerada, normaliza espacios y omite repetidos", () => {
    expect(parsePlayerNameList("1. Juan  Pérez\r\n2) Nico López\n\njuan pérez\n3- Diego Ruiz")).toEqual(["Juan Pérez", "Nico López", "Diego Ruiz"]);
  });
  it("rechaza entradas incompletas o demasiado grandes antes de escribir", () => {
    expect(() => parsePlayerNameList("  ")).toThrow();
    expect(() => parsePlayerNameList("Juan\nA")).toThrow();
    expect(() => parsePlayerNameList(Array.from({ length: 61 }, (_, index) => `Jugador ${index}`).join("\n"))).toThrow();
  });
});
