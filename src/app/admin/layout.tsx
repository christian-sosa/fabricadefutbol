import type { Metadata } from "next";

import { ACCESS_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Administración de tu grupo",
  robots: ACCESS_ROBOTS
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}
