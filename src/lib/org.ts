export function withOrgQuery(path: string, organizationKey?: string | null) {
  if (!organizationKey) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}org=${encodeURIComponent(organizationKey)}`;
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function slugifyOrganizationName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 50);
}
