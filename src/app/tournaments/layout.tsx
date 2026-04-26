import { notFound } from "next/navigation";

import { isTournamentsEnabled } from "@/lib/features";

export default function TournamentsLayout({ children }: { children: React.ReactNode }) {
  if (!isTournamentsEnabled()) {
    notFound();
  }

  return children;
}
