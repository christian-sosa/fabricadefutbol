import type { Metadata } from "next";
import { Suspense } from "react";

import "@/app/globals.css";
import { SiteHeader } from "@/components/layout/site-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Fabrica de Futbol",
  description: "Gestion de partidos de futbol entre amigos"
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const initialIsAuthenticated = Boolean(user);

  return (
    <html lang="es">
      <body>
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7913239873831344"
          crossOrigin="anonymous"
        ></script>
        <Suspense fallback={<div className="sticky top-0 z-30 h-[57px] border-b border-slate-800 bg-slate-950/85" />}>
          <SiteHeader initialIsAuthenticated={initialIsAuthenticated} />
        </Suspense>
        <main className="mx-auto w-full max-w-6xl px-4 py-6 md:py-8">{children}</main>
      </body>
    </html>
  );
}
