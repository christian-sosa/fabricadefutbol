import { notFound } from "next/navigation";

import { getCurrentUserCanAccessTournamentsProduct } from "@/lib/auth/super-admin";

export const metadata = {
  robots: {
    index: false,
    follow: false
  }
};

export default async function TournamentsLayout({ children }: { children: React.ReactNode }) {
  const canAccessTournaments = await getCurrentUserCanAccessTournamentsProduct();
  if (!canAccessTournaments) notFound();

  return children;
}
