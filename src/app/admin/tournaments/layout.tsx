import { notFound } from "next/navigation";

import { requireAdminSession } from "@/lib/auth/admin";

export default async function AdminTournamentInviteLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminSession();
  if (!admin.isSuperAdmin) notFound();

  return children;
}
