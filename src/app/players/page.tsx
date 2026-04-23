import { redirect } from "next/navigation";

import { parsePublicModule, withPublicQuery } from "@/lib/org";

export default async function PlayersPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string; module?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  redirect(
    withPublicQuery("/ranking", {
      organizationKey: resolvedSearchParams.org,
      module: parsePublicModule(resolvedSearchParams.module)
    })
  );
}
