import type { Metadata } from "next";

import "@/app/globals.css";
import { SiteHeader } from "@/components/layout/site-header";

export const metadata: Metadata = {
  title: "Fabrica de Futbol",
  description: "Gestion de partidos de futbol entre amigos"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <SiteHeader />
        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:py-8">{children}</main>
      </body>
    </html>
  );
}
