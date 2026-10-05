import { beforeEach, describe, expect, it, vi } from "vitest";

import { mapSupabaseError, toUserMessage } from "@/lib/errors";

describe("error helpers", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("mapea codigos de postgres a mensajes amigables", () => {
    expect(mapSupabaseError({ code: "23505", message: "duplicate key value" })).toContain(
      "Ya existe un registro"
    );
    expect(mapSupabaseError({ code: "42501", message: "permission denied" })).toContain(
      "No tenes permisos"
    );
  });

  it("usa fallback generico para errores tecnicos", () => {
    expect(toUserMessage(new Error('duplicate key on relation "players"'), "Fallback")).toBe("Fallback");
  });

  it.each([30, 45])("explica el límite de %s jugadores activos y cómo liberar lugar", (limit) => {
    expect(toUserMessage({ code: "23514", message: `Cada grupo admite un maximo de ${limit} jugadores activos.` }))
      .toBe(`Este grupo admite hasta ${limit} jugadores activos. Quitá a alguien del plantel para liberar un lugar; sus partidos y estadísticas se conservan.`);
  });

  it.each([
    'new row for relation "players" violates check constraint "players_rating_check"',
    "Cada grupo admite un maximo de 30 jugadores activos. Otro detalle técnico.",
    "Cada grupo admite un maximo de 0 jugadores activos."
  ])("conserva el mensaje genérico para otras validaciones: %s", (message) => {
    expect(mapSupabaseError({ code: "23514", message }))
      .toBe("Los datos enviados no cumplen una regla de validacion.");
  });

  it("requiere el código de validación para reconocer el límite", () => {
    expect(mapSupabaseError({ code: "XX000", message: "Cada grupo admite un maximo de 30 jugadores activos." }, "Fallback"))
      .toBe("Fallback");
  });

  it("deja pasar mensajes funcionales en espanol", () => {
    expect(toUserMessage(new Error("No puedes guardar el resultado."), "Fallback")).toBe(
      "No puedes guardar el resultado."
    );
  });
});
