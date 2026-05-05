import type { MetadataRoute } from "next";

import { getPublicAppUrl } from "@/lib/public-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/api", "/captain", "/clubs", "/invite", "/tournaments"]
    },
    sitemap: `${getPublicAppUrl()}/sitemap.xml`
  };
}
