import { describe, expect, it, vi } from "vitest";
import { readAllRows } from "@/lib/queries/read-all-rows";
describe("paginación de métricas", () => {
  it("recupera más de mil filas aunque el servidor limite cada página a 200", async () => {
    const rows = Array.from({ length: 1203 }, (_, id) => ({ id }));
    const read = vi.fn(async (from: number) => ({ data: rows.slice(from, from + 200), count: rows.length, error: null }));
    expect((await readAllRows(read)).data).toEqual(rows);
    expect(read).toHaveBeenCalledTimes(7);
  });
  it("devuelve el error en lugar de publicar totales parciales", async () => {
    const response = await readAllRows(async () => ({ data: null, error: { message: "connection failed" } }));
    expect(response).toEqual({ data: [], error: { message: "connection failed" } });
  });
});
