import { headers } from "next/headers";

import { canAccessClubsProduct } from "@/lib/features";
import { getPublicAppUrl } from "@/lib/public-url";
import {
  getPublicClubSiteByDomain,
  type PublicClubSiteDetails
} from "@/lib/queries/clubs";

export type ClubSiteRequestResolution = {
  host: string;
  isMainAppHost: boolean;
  data: PublicClubSiteDetails | null;
};

export function normalizeRequestHost(host: string | null | undefined) {
  return String(host ?? "").trim().toLowerCase().split(":")[0] ?? "";
}

export function hostBelongsToMainApp(host: string) {
  const normalizedHost = normalizeRequestHost(host);
  if (!normalizedHost) return true;
  if (["localhost", "127.0.0.1", "::1"].includes(normalizedHost)) return true;
  if (normalizedHost.endsWith(".localhost") || normalizedHost.endsWith(".vercel.app")) return true;

  try {
    const appHost = new URL(getPublicAppUrl()).hostname.toLowerCase().replace(/^www\./, "");
    return normalizedHost.replace(/^www\./, "") === appHost;
  } catch {
    return false;
  }
}

export function isClubSiteStandaloneHost(host: string | null | undefined) {
  if (!canAccessClubsProduct()) return false;

  const normalizedHost = normalizeRequestHost(host);
  return Boolean(normalizedHost && !hostBelongsToMainApp(normalizedHost));
}

export async function resolveClubSiteFromRequestHost(): Promise<ClubSiteRequestResolution> {
  const requestHeaders = await headers();
  const host = normalizeRequestHost(requestHeaders.get("host"));
  const isMainAppHost = hostBelongsToMainApp(host);

  if (isMainAppHost) {
    return { host, isMainAppHost, data: null };
  }

  if (!canAccessClubsProduct()) {
    return { host, isMainAppHost, data: null };
  }

  return {
    host,
    isMainAppHost,
    data: await getPublicClubSiteByDomain(host)
  };
}
