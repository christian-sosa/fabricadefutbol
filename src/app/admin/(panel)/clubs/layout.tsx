import { notFound } from "next/navigation";

import { canAccessClubsProduct } from "@/lib/features";

export default function AdminClubsLayout({ children }: { children: React.ReactNode }) {
  if (!canAccessClubsProduct()) notFound();

  return children;
}
