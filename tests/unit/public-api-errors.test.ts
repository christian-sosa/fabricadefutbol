import { describe, expect, it } from "vitest";

import { getPublicApiErrorMessage } from "@/lib/api-errors";

describe("public API error messages", () => {
  it("devuelve mensajes genericos para no filtrar detalles internos", () => {
    expect(
      getPublicApiErrorMessage(
        new Error('relation "players" does not exist: invalid input syntax for type uuid'),
        "No se pudo obtener la tabla."
      )
    ).toBe("No se pudo obtener la tabla.");
  });

  it("mantiene el mismo fallback para errores desconocidos", () => {
    expect(getPublicApiErrorMessage("fallo interno", "No se pudo obtener el historial.")).toBe(
      "No se pudo obtener el historial."
    );
  });
});
