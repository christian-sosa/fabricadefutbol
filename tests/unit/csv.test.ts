import { describe, expect, it } from "vitest";

import { csvCell, toCsv } from "@/lib/csv";

describe("csv helpers", () => {
  it("escapa comillas y separadores", () => {
    expect(csvCell('Liga "A", domingo')).toBe('"Liga ""A"", domingo"');
  });

  it("neutraliza valores que spreadsheets interpretan como formulas", () => {
    expect(csvCell("=IMPORTDATA(\"https://example.com\")")).toBe(
      "\"'=IMPORTDATA(\"\"https://example.com\"\")\""
    );
    expect(csvCell("+SUM(1,1)")).toBe("\"'+SUM(1,1)\"");
    expect(csvCell("-10")).toBe("\"'-10\"");
    expect(csvCell("@cmd")).toBe("\"'@cmd\"");
  });

  it("serializa filas completas", () => {
    expect(toCsv([["name", "value"], ["Equipo", "=1+1"]])).toBe('"name","value"\n"Equipo","\'=1+1"');
  });
});
