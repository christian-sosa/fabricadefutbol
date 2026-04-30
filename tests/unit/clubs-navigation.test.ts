import { describe, expect, it } from "vitest";

import { ADMIN_NAV_ITEMS, PRIMARY_PUBLIC_NAV_ITEMS, PUBLIC_NAV_ITEMS } from "@/lib/constants";

describe("clubes ocultos en navegacion", () => {
  it("no agrega clubes a navegacion publica ni admin", () => {
    const allLabels = [
      ...PUBLIC_NAV_ITEMS.map((item) => item.label),
      ...PRIMARY_PUBLIC_NAV_ITEMS.map((item) => item.label),
      ...ADMIN_NAV_ITEMS.map((item) => item.label)
    ];
    const allHrefs = [
      ...PUBLIC_NAV_ITEMS.map((item) => item.href),
      ...PRIMARY_PUBLIC_NAV_ITEMS.map((item) => item.href),
      ...ADMIN_NAV_ITEMS.map((item) => item.href)
    ];

    expect(allLabels).not.toContain("Clubes");
    expect(allHrefs).not.toContain("/clubs");
    expect(allHrefs).not.toContain("/admin/clubs");
  });
});
