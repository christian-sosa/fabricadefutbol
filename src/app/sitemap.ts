import type { MetadataRoute } from "next";

import { GUIDES } from "@/lib/guides";
import { getPublicAppUrl } from "@/lib/public-url";

const STATIC_PUBLIC_PATHS = [
  "/",
  "/groups",
  "/ranking",
  "/matches",
  "/upcoming",
  "/guides",
  "/help",
  "/feedback",
  "/about",
  "/terms",
  "/privacy"
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const appUrl = getPublicAppUrl();
  const routes = [
    ...STATIC_PUBLIC_PATHS,
    ...GUIDES.map((guide) => `/guides/${guide.slug}`)
  ];

  return routes.map((path) => ({
    url: `${appUrl}${path === "/" ? "/" : path}`,
    changeFrequency: path.startsWith("/guides") ? "monthly" : "weekly",
    priority: path === "/" ? 1 : path.startsWith("/guides") ? 0.8 : 0.7
  }));
}
