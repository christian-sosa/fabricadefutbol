import type { Metadata } from "next";
import { Suspense } from "react";
import { Analytics } from "@vercel/analytics/next";

import "@/app/globals.css";
import { BetaNotice } from "@/components/layout/beta-notice";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { ReactQueryProvider } from "@/components/providers/react-query-provider";
import { shouldRenderAds } from "@/lib/env";
import { getPublicAppUrl } from "@/lib/public-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const APP_URL = getPublicAppUrl();

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "Fábrica de Fútbol",
    template: "%s — Fábrica de Fútbol"
  },
  description:
    "Organizá partidos de fútbol entre amigos: equipos parejos, rendimiento, ranking, historial y próximas fechas.",
  applicationName: "Fábrica de Fútbol",
  keywords: [
    "fútbol",
    "amigos",
    "partidos",
    "equipos",
    "ranking",
    "estadísticas",
    "convocatoria"
  ],
  authors: [{ name: "Fábrica de Fútbol" }],
  robots: {
    index: true,
    follow: true
  },
  openGraph: {
    type: "website",
    locale: "es_AR",
    url: APP_URL,
    siteName: "Fábrica de Fútbol",
    title: "Fábrica de Fútbol",
    description:
      "Organizá partidos de fútbol entre amigos: equipos parejos, rendimiento, ranking, historial y próximas fechas."
  },
  twitter: {
    card: "summary_large_image",
    title: "Fábrica de Fútbol",
    description:
      "Organizá partidos de fútbol entre amigos: equipos parejos, rendimiento, ranking, historial y próximas fechas."
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" }
    ],
    shortcut: "/favicon-32x32.png",
    apple: "/apple-touch-icon.png"
  }
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const initialIsAuthenticated = Boolean(user);
  const adsEnabled = shouldRenderAds();

  return (
    <html lang="es">
      <body>
        <ReactQueryProvider>
          {adsEnabled ? (
            <script
              async
              src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7913239873831344"
              crossOrigin="anonymous"
            ></script>
          ) : null}
          <a className="skip-link" href="#contenido-principal">
            Saltar al contenido
          </a>
          <Suspense fallback={<div className="sticky top-0 z-30 h-[57px] border-b border-slate-800 bg-slate-950/85" />}>
            <SiteHeader initialIsAuthenticated={initialIsAuthenticated} />
          </Suspense>
          <BetaNotice />
          <main className="mx-auto w-full max-w-6xl px-4 py-6 md:py-8" id="contenido-principal">
            {children}
          </main>
          <Suspense fallback={<div className="h-[280px] border-t border-slate-800 bg-slate-950/80" />}>
            <SiteFooter />
          </Suspense>
        </ReactQueryProvider>
        <Analytics />
      </body>
    </html>
  );
}
