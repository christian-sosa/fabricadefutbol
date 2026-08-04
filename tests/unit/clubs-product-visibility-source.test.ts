import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function readSource(...segments: string[]) {
  return readFileSync(path.join(root, ...segments), "utf8");
}

describe("ocultamiento productivo de Clubes", () => {
  it("bloquea las rutas publicas y administrativas sin borrar su codigo", () => {
    const publicLayout = readSource("src", "app", "clubs", "layout.tsx");
    const adminLayout = readSource("src", "app", "admin", "(panel)", "clubs", "layout.tsx");
    const invitePage = readSource("src", "app", "admin", "clubs", "invite", "[token]", "page.tsx");

    expect(publicLayout).toContain("canAccessClubsProduct");
    expect(publicLayout).toContain("notFound()");
    expect(adminLayout).toContain("canAccessClubsProduct");
    expect(adminLayout).toContain("notFound()");
    expect(invitePage).toContain("if (!canAccessClubsProduct()) notFound();");
  });

  it("corta datos, acciones, dominios propios y endpoints en produccion", () => {
    const authSource = readSource("src", "lib", "auth", "clubs.ts");
    const querySource = readSource("src", "lib", "queries", "clubs.ts");
    const proxySource = readSource("proxy.ts");
    const inviteActionSource = readSource("src", "app", "admin", "clubs", "invite", "[token]", "actions.ts");
    const playerPhotoSource = readSource("src", "app", "api", "player-photo", "[id]", "route.ts");
    const imageRoutes = [
      ["club-logo", "[id]"],
      ["club-team-logo", "[id]"],
      ["club-site-hero", "[clubId]"],
      ["club-product-image", "[productId]"]
    ];

    expect(authSource).toContain("assertCanAccessClubsProduct()");
    expect(querySource).toContain("if (!canAccessClubsProduct()) return [];");
    expect(querySource).toContain("if (!canAccessClubsProduct()) return null;");
    expect(proxySource).toContain("if (!clubsProductEnabled)");
    expect(proxySource).toContain("isClubProductPath(pathname)");
    expect(proxySource).toContain("status: 404");
    expect(inviteActionSource).toContain("if (!canAccessClubsProduct()) notFound();");
    expect(playerPhotoSource).toContain("if (canAccessClubsProduct())");

    for (const [route, parameter] of imageRoutes) {
      const routeSource = readSource("src", "app", "api", route, parameter, "route.ts");
      expect(routeSource).toContain("if (!canAccessClubsProduct())");
      expect(routeSource).toContain("status: 404");
    }
  });

  it("lo excluye de navegacion, sitemap, robots y contacto productivos", () => {
    const constantsSource = readSource("src", "lib", "constants.ts");
    const sitemapSource = readSource("src", "app", "sitemap.ts");
    const robotsSource = readSource("src", "app", "robots.ts");
    const feedbackPageSource = readSource("src", "app", "feedback", "page.tsx");
    const feedbackActionSource = readSource("src", "app", "feedback", "actions.ts");

    expect(constantsSource).toContain("canAccessClubsProduct() ?");
    expect(sitemapSource).toContain('canAccessClubsProduct() ? ["/clubs"] : []');
    expect(robotsSource).toContain('"/clubs"');
    expect(feedbackPageSource).toContain("clubsProductEnabled ?");
    expect(feedbackActionSource).toContain('submittedModule === "clubs" && !clubsProductEnabled');
  });
});
