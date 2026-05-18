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
    expect(componentSource).toContain("Informacion");
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

  it("explica limites y campos comerciales del sitio en el admin", () => {
    const adminPageSource = readSource("src", "app", "admin", "(panel)", "clubs", "[clubId]", "page.tsx");
    const actionsSource = readSource("src", "app", "admin", "(panel)", "clubs", "[clubId]", "actions.ts");
    const uploadInputSource = expectFile("src", "components", "admin", "optimized-club-site-image-input.tsx");

    expect(adminPageSource).toContain("JPG, PNG o WEBP hasta");
    expect(adminPageSource).toContain("OptimizedClubSiteImageInput");
    expect(adminPageSource).toContain("MAX_CLUB_SITE_HERO_IMAGE_SIZE_MB");
    expect(adminPageSource).toContain("MAX_CLUB_PRODUCT_IMAGE_SIZE_MB");
    expect(adminPageSource).toContain("Tiene que estar habilitado y publicado");
    expect(adminPageSource).toContain("Orden en catalogo");
    expect(adminPageSource).toContain("Descripcion publica");
    expect(adminPageSource).toContain("Mensaje de consulta");
    expect(adminPageSource).toContain('id="new-product-image"');
    expect(actionsSource).toContain('const productImage = getRequiredFile(formData, "productImage");');
    expect(actionsSource).toContain("La foto principal no puede superar");
    expect(actionsSource).toContain("La imagen del producto no puede superar");
    expect(actionsSource).toContain("No se pudo procesar la imagen");
    expect(uploadInputSource).toContain("canvas.toBlob");
    expect(uploadInputSource).toContain("new DataTransfer()");
    expect(uploadInputSource).toContain("image/webp");
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
    expect(componentSource).toContain("Fabrica de Futbol");
    expect(componentSource).not.toContain("-my-6");
    expect(componentSource).not.toContain("bg-[#f7f3ec]");
  });

  it("convierte el inicio de La Quinta en vidriera de catalogo sin carrito", () => {
    const componentSource = readSource("src", "components", "clubs", "club-site.tsx");

    expect(componentSource).toContain("getClubHeroHeadline");
    expect(componentSource).toContain("Esta locura de amarte me impide ser normal");
    expect(componentSource).toContain("ClubSiteHomeHero");
    expect(componentSource).toContain("ClubSiteCategoryRail");
    expect(componentSource).toContain("Destacados");
    expect(componentSource).toContain("Tienda oficial");
    expect(componentSource).toContain("Consultar por WhatsApp");
    expect(componentSource).toContain("object-contain");
    expect(componentSource).toContain("--club-line");
    expect(componentSource).toContain("--club-soft");
    expect(componentSource).not.toContain("Catalogo oficial");
    expect(componentSource).not.toContain("Agregar al carrito");
    expect(componentSource).not.toMatch(/\bcarrito\b/i);
    expect(componentSource).not.toMatch(/\bcheckout\b/i);
    expect(componentSource).not.toContain("Toda la info del club en un solo sitio.");
    expect(componentSource).not.toContain("mitiendanube.com");
    expect(componentSource).not.toContain("dcdn-us.mitiendanube.com");
  });

  it("usa navegacion de tienda con categorias y footer social de pertenencia a Fabrica", () => {
    const componentSource = readSource("src", "components", "clubs", "club-site.tsx");

    expect(componentSource).toContain("ClubSiteHeader");
    expect(componentSource).toContain("ClubSiteFooter");
    expect(componentSource).toContain("getCatalogCategories");
    expect(componentSource).toContain("resolveClubSocialLinks");
    expect(componentSource).toContain('active === "home" ?');
    expect(componentSource).toMatch(/label: "Inicio"[\s\S]*label: "Productos"[\s\S]*label: "Informacion"/);
    expect(componentSource).toContain('alt="Logo de Fabrica de Futbol"');
    expect(componentSource).toContain('src="/logo.png"');
    expect(componentSource).toContain("Instagram");
    expect(componentSource).toContain("TikTok");
    expect(componentSource).toContain("YouTube");
    expect(componentSource).toContain("WhatsApp");
    expect(componentSource).toContain("Este catalogo pertenece a Fabrica de Futbol");
    expect(componentSource).not.toContain("Datos del equipo");
  });

  it("empuja el footer al borde inferior cuando una pagina de club tiene poco contenido", () => {
    const componentSource = readSource("src", "components", "clubs", "club-site.tsx");

    expect(componentSource).toContain("min-h-screen w-full flex-col");
    expect(componentSource).toContain("max-w-7xl flex-1");
  });

  it("usa metadata absoluta para que el dominio de club no herede el sufijo de Fabrica", () => {
    const rootClubSource = readSource("src", "app", "page.tsx");
    const slugClubSource = readSource("src", "app", "clubs", "[slug]", "page.tsx");
    const catalogSource = readSource("src", "app", "catalogo", "page.tsx");
    const teamDataSource = readSource("src", "app", "equipo", "page.tsx");

    expect(rootClubSource).toContain("absolute: data.club.name");
    expect(slugClubSource).toContain("absolute: data.club.name");
    expect(catalogSource).toContain("absolute: `Catalogo - ${data.club.name}`");
    expect(teamDataSource).toContain("absolute: `Informacion - ${data.club.name}`");
  });
});
