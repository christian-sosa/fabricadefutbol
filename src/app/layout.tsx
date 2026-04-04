import type { Metadata } from "next";
import Script from "next/script";
import { Suspense } from "react";

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
        <Script
          crossOrigin="anonymous"
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7913239873831344"
          strategy="afterInteractive"
        />
        <Suspense fallback={<div className="sticky top-0 z-30 h-[57px] border-b border-slate-800 bg-slate-950/85" />}>
          <SiteHeader />
        </Suspense>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:py-8">{children}</main>
      </body>
    </html>
  );
}
