import { notFound } from "next/navigation";

import { isTournamentsEnabled } from "@/lib/features";

export default function AdminTournamentInviteLayout({ children }: { children: React.ReactNode }) {
  if (!isTournamentsEnabled()) {
    notFound();
  }

  return children;
}
