import Link from "next/link";
import { DemoGroup } from "./demo-group";

export const metadata = { title: "Grupo de ejemplo", robots: { index: false, follow: true } };

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-xs font-semibold text-slate-400">Demo · todos los datos son ficticios</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-100">Los amigos del miércoles</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          12 jugadores, un partido y todo el grupo al día. Probá otras combinaciones de equipos o consultá el ranking, sin crear una cuenta.
        </p>
      </header>
      <DemoGroup />
      <section className="border-t border-slate-800 pt-5 sm:flex sm:items-center sm:justify-between sm:gap-5">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Ahora, con tu grupo.</h2>
          <p className="mt-1 text-sm text-slate-300">Gratis y sin registro para los jugadores.</p>
        </div>
        <Link
          className="mt-4 inline-flex min-h-12 w-full shrink-0 items-center justify-center rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground transition hover:brightness-110 sm:mt-0 sm:w-auto"
          href="/admin/login?mode=register"
        >
          Crear mi grupo gratis
        </Link>
      </section>
    </div>
  );
}
