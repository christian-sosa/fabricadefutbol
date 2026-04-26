import { redirect } from "next/navigation";

import { isTournamentsEnabled, TOURNAMENTS_DISABLED_ADMIN_MESSAGE } from "@/lib/features";

export default function AdminTournamentsLayout({ children }: { children: React.ReactNode }) {
  if (!isTournamentsEnabled()) {
    redirect(`/admin?error=${encodeURIComponent(TOURNAMENTS_DISABLED_ADMIN_MESSAGE)}`);
  }

  return children;
}
