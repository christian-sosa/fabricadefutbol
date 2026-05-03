import { describe, expect, it } from "vitest";

import {
  buildOrganizationSeasonInsert,
  getAnnualOrganizationSeasonEndDate
} from "@/lib/domain/organization-seasons";

describe("organization season dates", () => {
  it("usa fin de año como cierre anual fijo de una temporada", () => {
    expect(getAnnualOrganizationSeasonEndDate(new Date("2026-05-03T12:00:00.000Z"))).toBe("2026-12-31");
  });

  it("crea temporadas anuales sin recibir una fecha editable", () => {
    const result = buildOrganizationSeasonInsert({
      organizationId: "org-1",
      createdBy: "admin-1",
      startsAt: new Date("2026-05-03T12:00:00.000Z")
    });

    expect(result).toEqual({
      organization_id: "org-1",
      label: "Temporada 2026",
      duration_months: 8,
      starts_at: "2026-05-03",
      ends_at: "2026-12-31",
      status: "active",
      created_by: "admin-1"
    });
  });

  it("permite que una temporada creada el 31 de diciembre cierre ese mismo dia", () => {
    const result = buildOrganizationSeasonInsert({
      organizationId: "org-1",
      startsAt: new Date("2026-12-31T12:00:00.000Z")
    });

    expect(result.starts_at).toBe("2026-12-31");
    expect(result.ends_at).toBe("2026-12-31");
    expect(result.duration_months).toBe(1);
  });
});
