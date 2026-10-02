import type { Metadata } from "next";

import { ACCESS_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Invitación a un grupo",
  robots: ACCESS_ROBOTS
};

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
