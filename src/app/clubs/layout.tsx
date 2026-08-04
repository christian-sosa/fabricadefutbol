import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { canAccessClubsProduct } from "@/lib/features";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export default function ClubsLayout({ children }: { children: React.ReactNode }) {
  if (!canAccessClubsProduct()) notFound();

  return children;
}
