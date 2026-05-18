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
    expect(listSource).toContain("¿Querés traer tu club o equipo?");
    expect(listSource).toContain("/feedback?intent=club");
    expect(listSource).toContain("Quiero traer mi club");
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

  it("renderiza dominios propios de club sin header, footer ni contenedor global de Fabrica", () => {
    const layoutSource = readSource("src", "app", "layout.tsx");
    const componentSource = readSource("src", "components", "clubs", "club-site.tsx");

    expect(layoutSource).toContain("isClubSiteStandaloneHost");
    expect(layoutSource).toContain("standaloneClubSite");
    expect(layoutSource).toContain("{standaloneClubSite ? (");
    expect(layoutSource).toContain('<main className="w-full" id="contenido-principal">');
    expect(componentSource).toContain("Volver a Fabrica");
    expect(componentSource).not.toContain("-my-6");
    expect(componentSource).not.toContain("bg-[#f7f3ec]");
  });

  it("mantiene la estetica de club cerca de la referencia La Quinta sin copiar assets externos", () => {
    const componentSource = readSource("src", "components", "clubs", "club-site.tsx");

    expect(componentSource).toContain("getClubHeroHeadline");
    expect(componentSource).toContain("Esta locura de amarte me impide ser normal");
    expect(componentSource).toContain("--club-line");
    expect(componentSource).toContain("--club-soft");
    expect(componentSource).toContain("Catalogo oficial");
    expect(componentSource).not.toContain("mitiendanube.com");
    expect(componentSource).not.toContain("dcdn-us.mitiendanube.com");
  });

  it("usa metadata absoluta para que el dominio de club no herede el sufijo de Fabrica", () => {
    const rootClubSource = readSource("src", "app", "page.tsx");
    const slugClubSource = readSource("src", "app", "clubs", "[slug]", "page.tsx");
    const catalogSource = readSource("src", "app", "catalogo", "page.tsx");
    const teamDataSource = readSource("src", "app", "equipo", "page.tsx");

    expect(rootClubSource).toContain("absolute: data.club.name");
    expect(slugClubSource).toContain("absolute: data.club.name");
    expect(catalogSource).toContain("absolute: `Catalogo - ${data.club.name}`");
    expect(teamDataSource).toContain("absolute: `Datos - ${data.club.name}`");
  });
});
