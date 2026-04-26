import { isTournamentsEnabled } from "@/lib/features";

export type PublicModuleContext = "organizations" | "tournaments";

export function parsePublicModule(value: string | null | undefined): PublicModuleContext | null {
  if (value === "organizations" || value === "groups") return "organizations";
  if (value === "tournaments" && isTournamentsEnabled()) return value;
  return null;
}

export function resolvePublicModule(value: string | null | undefined): PublicModuleContext {
  return parsePublicModule(value) ?? "organizations";
}

export function withPublicQuery(
  path: string,
  params?: {
    organizationKey?: string | null;
    module?: PublicModuleContext | null;
  }
) {
  const query = new URLSearchParams();

  if (params?.organizationKey) {
    query.set("org", params.organizationKey);
  }

  const publicModule = params?.module === "tournaments" && !isTournamentsEnabled() ? "organizations" : params?.module;

  if (publicModule) {
    query.set("module", publicModule === "organizations" ? "groups" : publicModule);
  }

  const queryString = query.toString().replace(/\+/g, "%20");
  if (!queryString) return path;

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${queryString}`;
}

export function withOrgQuery(path: string, organizationKey?: string | null) {
  return withPublicQuery(path, {
    organizationKey
  });
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function slugifyName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 50);
}

export function slugifyOrganizationName(value: string) {
  return slugifyName(value);
}

export function slugifyTournamentName(value: string) {
  return slugifyName(value);
}
