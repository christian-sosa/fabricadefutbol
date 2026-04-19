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

  it("deja pasar mensajes funcionales en espanol", () => {
    expect(toUserMessage(new Error("No puedes guardar el resultado."), "Fallback")).toBe(
      "No puedes guardar el resultado."
    );
  });
});
