import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

const adminLandingPath = path.join(root, "src", "app", "admin", "(panel)", "page.tsx");
const groupCardPath = path.join(root, "src", "components", "admin", "admin-current-group-card.tsx");

describe("admin context navigation source", () => {
  it("no muestra facturacion como parte de Grupos", () => {
    const groupCardSource = readFileSync(groupCardPath, "utf8");
    const adminLandingSource = readFileSync(adminLandingPath, "utf8");

    expect(groupCardSource).toContain("configuracion se guardan aca");
    expect(adminLandingSource).toContain("Creá tu primer grupo");
    expect(groupCardSource).not.toContain("facturacion");
    expect(adminLandingSource).not.toContain("facturacion");
  });

  it("mantiene selección explícita y abre directamente un único grupo", () => {
    const adminLandingSource = readFileSync(adminLandingPath, "utf8");

    expect(adminLandingSource).toContain("resolvedSearchParams.org");
    expect(adminLandingSource).toContain("const selectedOrganization = resolvedSearchParams.org");
    expect(adminLandingSource).not.toContain(
      "const selectedOrganization = findOrganizationByKey(organizations, resolvedSearchParams.org);"
    );
  });
});
