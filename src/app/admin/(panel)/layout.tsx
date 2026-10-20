import { AdminPanelShell } from "@/components/admin/admin-panel-shell";
import { ReactQueryProvider } from "@/components/providers/react-query-provider";
import { requireAdminSession } from "@/lib/auth/admin";

export default async function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdminSession();

  return <ReactQueryProvider><AdminPanelShell admin={admin}>{children}</AdminPanelShell></ReactQueryProvider>;
}
