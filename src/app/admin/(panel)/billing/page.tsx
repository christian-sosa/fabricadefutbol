import { redirect } from "next/navigation";

import { withOrgQuery } from "@/lib/org";

export default async function AdminBillingPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  redirect(withOrgQuery("/admin", resolvedSearchParams.org ?? null));
}
