import { AdminPanelShell } from "@/components/admin/admin-panel-shell";
import { requireAdminSession } from "@/lib/auth/admin";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminSession();

  return <AdminPanelShell admin={admin}>{children}</AdminPanelShell>;
}
