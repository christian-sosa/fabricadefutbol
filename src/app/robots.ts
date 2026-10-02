import type { MetadataRoute } from "next";

import { getPublicAppUrl } from "@/lib/public-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      // Las pantallas públicas de acceso se pueden rastrear para leer su noindex.
      allow: ["/", "/admin/login", "/admin/forgot-password"],
      disallow: [
        "/admin",
        "/api",
        "/auth",
        "/invite",
      ]
    },
    sitemap: `${getPublicAppUrl()}/sitemap.xml`
  };
}
