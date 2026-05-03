import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardTitle } from "@/components/ui/card";
import { getGuideBySlug, GUIDES } from "@/lib/guides";

type GuidePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) return {};

  return {
    title: guide.title,
    description: guide.description
  };
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const guide = getGuideBySlug(slug);
  if (!guide) notFound();

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <Link className="text-sm font-semibold text-emerald-300 transition hover:underline" href="/guides">
        Volver a guías
      </Link>

      <header className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-6 shadow-[0_18px_40px_-28px_rgba(16,185,129,0.65)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
          Guía · {guide.readingTime}
        </p>
        <h1 className="mt-3 text-4xl font-black text-white">{guide.title}</h1>
        <p className="mt-4 text-base leading-7 text-slate-300">{guide.description}</p>
      </header>

      <div className="space-y-4">
        {guide.sections.map((section) => (
          <Card className="p-5" key={section.title}>
            <CardTitle>{section.title}</CardTitle>
            <div className="mt-3 space-y-3 text-sm leading-6 text-slate-300">
              {section.body.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </article>
  );
}
