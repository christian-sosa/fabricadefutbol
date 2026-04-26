import { describe, expect, it } from "vitest";

import { formatRendimiento, formatRendimientoDelta } from "@/lib/utils";

describe("formato de rendimiento", () => {
  it("muestra el rendimiento sin decimales", () => {
    expect(formatRendimiento(1030)).toBe("1030");
    expect(formatRendimiento("1030.49")).toBe("1030");
    expect(formatRendimiento(1030.5)).toBe("1031");
  });

  it("muestra deltas enteros con signo cuando suma", () => {
    expect(formatRendimientoDelta(10)).toBe("+10");
    expect(formatRendimientoDelta(-20)).toBe("-20");
    expect(formatRendimientoDelta(0)).toBe("0");
  });
});
