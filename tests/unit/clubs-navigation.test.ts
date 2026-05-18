import { describe, expect, it } from "vitest";

import { ADMIN_NAV_ITEMS, PRIMARY_PUBLIC_NAV_ITEMS, PUBLIC_NAV_ITEMS } from "@/lib/constants";

describe("clubes en navegacion publica", () => {
  it("agrega Clubes a navegacion publica sin convertirlo en seccion admin global", () => {
    const allLabels = [
      ...PUBLIC_NAV_ITEMS.map((item) => item.label),
      ...PRIMARY_PUBLIC_NAV_ITEMS.map((item) => item.label)
    ];
    const allHrefs = [
      ...PUBLIC_NAV_ITEMS.map((item) => item.href),
      ...PRIMARY_PUBLIC_NAV_ITEMS.map((item) => item.href)
    ];

    expect(allLabels).toContain("Clubes");
    expect(allHrefs).toContain("/clubs");
    expect(ADMIN_NAV_ITEMS.map((item) => item.href)).not.toContain("/admin/clubs");
    expect(allHrefs).not.toContain("/admin/clubs");
  });
});
