import { describe, expect, it } from "vitest";

import { normalizeEmail, slugifyOrganizationName, withOrgQuery } from "@/lib/org";

describe("org helpers", () => {
  it("agrega org al query string sin romper params existentes", () => {
    expect(withOrgQuery("/ranking", "liga-a")).toBe("/ranking?org=liga-a");
    expect(withOrgQuery("/matches?page=2", "liga a")).toBe("/matches?page=2&org=liga%20a");
  });

  it("normaliza emails", () => {
    expect(normalizeEmail("  USER@Example.COM ")).toBe("user@example.com");
  });

  it("slugifica nombres con acentos y basura", () => {
    expect(slugifyOrganizationName("  La Fabrica del Futbol!!!  ")).toBe("la-fabrica-del-futbol");
    expect(slugifyOrganizationName("Club Atletico San Martin y Compañia Limitada")).toBe(
      "club-atletico-san-martin-y-compania-limitada"
    );
  });
});
