import { describe, expect, it } from "vitest";

import {
  normalizeEmail,
  parsePublicModule,
  resolvePublicModule,
  slugifyOrganizationName,
  slugifyTournamentName,
  withOrgQuery,
  withPublicQuery
} from "@/lib/org";

describe("org helpers", () => {
  it("agrega org al query string sin romper params existentes", () => {
    expect(withOrgQuery("/ranking", "liga-a")).toBe("/ranking?org=liga-a");
    expect(withOrgQuery("/matches?page=2", "liga a")).toBe("/matches?page=2&org=liga%20a");
    expect(withOrgQuery("/tournaments", null)).toBe("/tournaments");
  });

  it("reconoce y resuelve el contexto publico del modulo", () => {
    expect(parsePublicModule("organizations")).toBe("organizations");
    expect(parsePublicModule("tournaments")).toBe("tournaments");
    expect(parsePublicModule("otra-cosa")).toBeNull();
    expect(parsePublicModule(undefined)).toBeNull();
    expect(resolvePublicModule("tournaments")).toBe("tournaments");
    expect(resolvePublicModule(null)).toBe("organizations");
  });

  it("combina org y modulo en un query string publico", () => {
    expect(withPublicQuery("/help", { organizationKey: "liga a", module: "tournaments" })).toBe(
      "/help?org=liga%20a&module=tournaments"
    );
    expect(withPublicQuery("/pricing?from=home", { module: "organizations" })).toBe(
      "/pricing?from=home&module=organizations"
    );
    expect(withPublicQuery("/feedback")).toBe("/feedback");
  });

  it("normaliza emails", () => {
    expect(normalizeEmail("  USER@Example.COM ")).toBe("user@example.com");
  });

  it("slugifica nombres con acentos y basura", () => {
    expect(slugifyOrganizationName("  La Fabrica del Futbol!!!  ")).toBe("la-fabrica-del-futbol");
    expect(slugifyOrganizationName("Club Atletico San Martin y Compania Limitada")).toBe(
      "club-atletico-san-martin-y-compania-limitada"
    );
  });

  it("slugifica torneos reutilizando la misma regla base", () => {
    expect(slugifyTournamentName("Torneo Apertura 2026 / Zona Norte")).toBe("torneo-apertura-2026-zona-norte");
  });
});
