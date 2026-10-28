"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getSeasonClosing } from "@/lib/domain/season-closing";

export function SeasonClosingCountdown({ initialNow }: { initialNow: string }) {
  const [now, setNow] = useState(initialNow);
  const router = useRouter();
  const closing = getSeasonClosing(new Date(now));

  useEffect(() => {
    function updateDate() {
      const nextNow = new Date();
      if (getSeasonClosing(nextNow).date === closing.date) return;
      setNow(nextNow.toISOString());
      // Refresh the points and PJ too, especially when a new season begins.
      router.refresh();
    }

    updateDate();
    const timer = window.setInterval(updateDate, 60_000);
    document.addEventListener("visibilitychange", updateDate);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", updateDate);
    };
  }, [closing.date, router]);

  if (!closing.isClosingPeriod) return null;

  return (
    <div className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-3 sm:p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Recta final · Temporada {closing.year}</p>
      <p className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">
        {closing.daysRemaining === 1 ? "Hoy cierra la temporada" : <>Faltan <span className="tabular-nums">{closing.daysRemaining}</span> días</>}
      </p>
      <p className="mt-1 text-xs text-slate-300">El año y la temporada terminan el 31 de diciembre.</p>
      <p className="mt-3 text-sm leading-relaxed text-slate-200">
        {closing.fullWeeksRemaining > 0
          ? <>Si juegan una vez por semana, podrían jugar <strong className="text-white">{closing.fullWeeksRemaining === 1 ? "un partido más" : `unos ${closing.fullWeeksRemaining} partidos más`}</strong>.</>
          : "Queda menos de una semana: todavía puede entrar un último partido."}
      </p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">Estimación orientativa; depende del día en que jueguen y de las pausas del grupo.</p>
    </div>
  );
}
