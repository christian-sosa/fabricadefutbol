import type { Metadata } from "next";

import { ACCESS_ROBOTS } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Acceso a tu cuenta",
  robots: ACCESS_ROBOTS
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
