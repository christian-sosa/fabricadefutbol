import { redirect } from "next/navigation";

export default async function OrganizationsPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string; module?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const query = new URLSearchParams();

  if (resolvedSearchParams.org) {
    query.set("org", resolvedSearchParams.org);
  }

  if (resolvedSearchParams.module) {
    query.set("module", resolvedSearchParams.module);
  }

  const queryString = query.toString();
  redirect(queryString ? `/groups?${queryString}` : "/groups");
}
