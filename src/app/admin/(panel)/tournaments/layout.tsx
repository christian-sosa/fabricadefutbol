import { notFound } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/admin";

export default async function AdminTournamentsLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminSession();
  if (!admin.isSuperAdmin) notFound();

  return children;
}
