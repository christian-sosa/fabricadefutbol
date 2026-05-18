import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function readSource(...segments: string[]) {
  return readFileSync(path.join(root, ...segments), "utf8");
}

function expectFile(...segments: string[]) {
  const filePath = path.join(root, ...segments);
  expect(existsSync(filePath), filePath).toBe(true);
  return readFileSync(filePath, "utf8");
}

describe("club site productizado", () => {
  it("separa landing, home, catalogo y datos del equipo usando la capa Club Site", () => {
    const listSource = expectFile("src", "app", "clubs", "page.tsx");
    const homeSource = expectFile("src", "app", "clubs", "[slug]", "page.tsx");
    const catalogSource = expectFile("src", "app", "clubs", "[slug]", "catalogo", "page.tsx");
    const teamDataSource = expectFile("src", "app", "clubs", "[slug]", "equipo", "page.tsx");
    const componentSource = expectFile("src", "components", "clubs", "club-site.tsx");

    expect(listSource).toContain("getPublicClubSites");
    expect(listSource).toContain("Ver sitio");
    expect(listSource).toContain("¿Querés traer tu club a Fábrica de Fútbol?");
    expect(homeSource).toContain("getPublicClubSiteBySlug");
    expect(homeSource).toContain("ClubSiteHome");
    expect(catalogSource).toContain("ClubSiteCatalog");
    expect(teamDataSource).toContain("ClubSiteTeamData");
    expect(componentSource).toContain("buildClubProductContactHref");
    expect(componentSource).toContain("Catalogo");
    expect(componentSource).not.toMatch(/\bcheckout\b/i);
    expect(componentSource).not.toMatch(/\bcarrito\b/i);
  });

  it("agrega una pestaña Sitio al admin de club para identidad, secciones y productos", () => {
    const adminPageSource = readSource("src", "app", "admin", "(panel)", "clubs", "[clubId]", "page.tsx");

    expect(adminPageSource).toContain("updateClubSiteSettingsAction");
    expect(adminPageSource).toContain("addClubProductAction");
    expect(adminPageSource).toContain("updateClubProductAction");
    expect(adminPageSource).toContain('function SiteTab');
    expect(adminPageSource).toContain('{ key: "site", label: "Sitio" }');
    expect(adminPageSource).toContain("details.siteSettings");
    expect(adminPageSource).toContain("details.products");
    expect(adminPageSource).toContain('name={`section:${key}`}');
  });

  it("declara tipos de base para settings y catalogo sin depender de HTML estatico", () => {
    const databaseSource = readSource("src", "types", "database.ts");
    const querySource = readSource("src", "lib", "queries", "clubs.ts");

    expect(databaseSource).toContain("club_site_settings");
    expect(databaseSource).toContain("club_products");
    expect(databaseSource).toContain("section_visibility: Json");
    expect(databaseSource).toContain('status: "available" | "sold_out" | "preorder" | "hidden"');
    expect(querySource).toContain("getPublicClubSites");
    expect(querySource).toContain("getPublicClubSiteByDomain");
  });

  it("prepara proxy de dominio propio dentro del mismo proyecto Vercel", () => {
    const proxySource = readSource("proxy.ts");

    expect(proxySource).toContain("resolveClubSiteRewrite");
    expect(proxySource).toContain('.from("club_site_settings")');
    expect(proxySource).toContain('.from("clubs")');
    expect(proxySource).toContain("hostBelongsToMainApp");
    expect(proxySource).toContain('"/catalogo/:path*"');
    expect(proxySource).toContain('"/equipo/:path*"');
    expect(proxySource).toContain('"/clubs/:path*"');
  });

  it("resuelve el dominio propio del club desde rutas limpias", () => {
    const resolverSource = expectFile("src", "lib", "club-site-request.ts");
    const rootSource = readSource("src", "app", "page.tsx");
    const catalogSource = expectFile("src", "app", "catalogo", "page.tsx");
    const teamDataSource = expectFile("src", "app", "equipo", "page.tsx");

    expect(resolverSource).toContain("getPublicClubSiteByDomain");
    expect(rootSource).toContain("resolveClubSiteFromRequestHost");
    expect(rootSource).toContain("ClubSiteHome");
    expect(catalogSource).toContain("resolveClubSiteFromRequestHost");
    expect(catalogSource).toContain("ClubSiteCatalog");
    expect(teamDataSource).toContain("resolveClubSiteFromRequestHost");
    expect(teamDataSource).toContain("ClubSiteTeamData");
  });
});
