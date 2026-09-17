"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ACTIVITY_WEEKDAYS, formatActivityDate, getActivityMonthDays, isActivityDate, shiftActivityDate, shiftActivityMonth, summarizeMatchActivity, type CalendarMatch } from "@/lib/match-activity";
import { matchIsoToDateInput, matchIsoToTimeInput } from "@/lib/match-datetime";
import { buildMatchHistoryHref } from "@/lib/match-history-navigation";
import { cn } from "@/lib/utils";

type MatchActivityCalendarProps = {
  matches: CalendarMatch[];
  organizationSlug: string;
  season: string;
  today: string;
  seasonStartsAt?: string;
  seasonEndsAt?: string;
  historyPage?: number;
};

export function MatchActivityCalendar({ matches, organizationSlug, season, today, seasonStartsAt, seasonEndsAt, historyPage }: MatchActivityCalendarProps) {
  const end = seasonEndsAt && seasonEndsAt < today ? seasonEndsAt : today;
  const playedDates = matches.map((match) => matchIsoToDateInput(match.scheduledAt))
    .filter((day) => isActivityDate(day) && day <= end).sort();
  const firstDay = playedDates[0] ?? end;
  // Legacy seasons can contain matches played before their recorded creation date.
  const start = seasonStartsAt && firstDay < seasonStartsAt ? firstDay : seasonStartsAt;
  const lastDay = playedDates.at(-1) ?? end;
  const [range, setRange] = useState({ from: firstDay, to: end });
  const [month, setMonth] = useState(lastDay.slice(0, 7));
  const [selectedDay, setSelectedDay] = useState<string | null>(lastDay);
  const validRange = isActivityDate(range.from) && isActivityDate(range.to) && range.from <= range.to && range.to <= end && (!start || range.from >= start);
  const activity = useMemo(() => summarizeMatchActivity(matches, range.from, validRange ? range.to : ""), [matches, range.from, range.to, validRange]);
  const minMonth = validRange ? range.from.slice(0, 7) : firstDay.slice(0, 7);
  const maxMonth = validRange ? range.to.slice(0, 7) : end.slice(0, 7);
  const visibleMonth = month < minMonth ? minMonth : month > maxMonth ? maxMonth : month;
  const days = getActivityMonthDays(visibleMonth);
  const monthCount = days.reduce((count, day) => count + (day ? activity.byDay.get(day)?.length ?? 0 : 0), 0);
  const visibleSelectedDay = selectedDay?.startsWith(visibleMonth) && activity.byDay.has(selectedDay) ? selectedDay : null;
  const dayMatches = visibleSelectedDay ? activity.byDay.get(visibleSelectedDay) ?? [] : [];
  const average = activity.weeklyAverage?.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  function chooseRange(from: string, to: string) {
    setRange({ from, to });
    setMonth(to.slice(0, 7));
    setSelectedDay(null);
  }

  if (!playedDates.length) {
    return <Card className="py-10 text-center"><CardTitle>El calendario espera el primer partido</CardTitle><CardDescription className="mx-auto mt-2 max-w-md">Cuando haya un resultado cargado en este período, vas a ver los días jugados y el ritmo del grupo.</CardDescription></Card>;
  }

  return (
    <section aria-label="Calendario de actividad" className="space-y-4">
      <Card className="overflow-hidden border-emerald-400/25 bg-gradient-to-br from-emerald-950/60 to-card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Cada partido cuenta</p>
            <CardTitle className="mt-2 text-2xl font-black">El ritmo del grupo</CardTitle>
            <CardDescription className="mt-2 max-w-xl">Los encuentros que se hicieron realidad. Elegí un período y mirá cuánto fútbol compartieron.</CardDescription>
          </div>
          <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">Sólo partidos finalizados</span>
        </div>
        <div className="mt-5 grid gap-3 border-t border-emerald-400/15 pt-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto] lg:items-end">
          <label className="min-w-0 flex-1 text-xs font-semibold text-slate-300">Desde
            <Input aria-describedby={!validRange ? "activity-range-error" : undefined} aria-invalid={!validRange} className="mt-1.5 [color-scheme:dark]" max={range.to || end} min={start} onChange={(event) => setRange({ ...range, from: event.target.value })} type="date" value={range.from} />
          </label>
          <label className="min-w-0 flex-1 text-xs font-semibold text-slate-300">Hasta
            <Input aria-describedby={!validRange ? "activity-range-error" : undefined} aria-invalid={!validRange} className="mt-1.5 [color-scheme:dark]" max={end} min={range.from} onChange={(event) => setRange({ ...range, to: event.target.value })} type="date" value={range.to} />
          </label>
          <Button onClick={() => chooseRange(firstDay, end)} variant="secondary">Desde el primer partido</Button>
          <Button onClick={() => chooseRange(start && start > shiftActivityDate(end, -29) ? start : shiftActivityDate(end, -29), end)} variant="secondary">Últimos 30 días</Button>
        </div>
        {!validRange ? <p className="mt-3 text-sm text-amber-200" id="activity-range-error" role="alert">Elegí fechas válidas: Desde debe ser anterior o igual a Hasta, y Hasta no puede superar el {formatActivityDate(end)}.{start ? ` El período disponible empieza el ${formatActivityDate(start)}. Para ampliar el período, elegí Histórico.` : ""}</p> : (
          <div aria-live="polite" className="mt-6">
            <p className="text-sm text-slate-300">Del <strong className="text-slate-100">{formatActivityDate(range.from)}</strong> al <strong className="text-slate-100">{formatActivityDate(range.to)}</strong>, el grupo jugó:</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-6 sm:grid-cols-3">
              <div><dt className="text-sm text-slate-400">Partidos</dt><dd className="mt-1 text-4xl font-black tabular-nums text-emerald-300">{activity.totalMatches}</dd></div>
              <div><dt className="text-sm text-slate-400">Partidos por semana</dt><dd className="mt-1 text-4xl font-black tabular-nums text-slate-100">{average ?? "—"}</dd></div>
              <div><dt className="text-sm text-slate-400">Días con fútbol</dt><dd className="mt-1 text-4xl font-black tabular-nums text-slate-100">{activity.playedDays}</dd></div>
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-slate-400">{activity.days >= 7 ? `Promedio sobre los ${activity.days} días del período, incluidas las semanas sin partidos.` : "El promedio semanal aparece al seleccionar al menos 7 días."}</p>
          </div>
        )}
      </Card>

      {validRange ? <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card className="min-w-0 p-3 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <Button aria-label="Mes anterior" className="shrink-0 px-3" disabled={visibleMonth <= minMonth} onClick={() => { setMonth(shiftActivityMonth(visibleMonth, -1)); setSelectedDay(null); }} variant="ghost">←</Button>
            <div className="min-w-0 text-center" aria-live="polite">
              <h3 className="font-bold capitalize text-slate-100" id="activity-month-title">{formatActivityDate(`${visibleMonth}-01`, { day: undefined })}</h3>
              <p className="mt-0.5 text-xs text-slate-400">{monthCount} {monthCount === 1 ? "partido" : "partidos"} en el período</p>
            </div>
            <Button aria-label="Mes siguiente" className="shrink-0 px-3" disabled={visibleMonth >= maxMonth} onClick={() => { setMonth(shiftActivityMonth(visibleMonth, 1)); setSelectedDay(null); }} variant="ghost">→</Button>
          </div>
          <label className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-400">Ir al mes
            <Input className="w-auto min-w-0 max-w-48 [color-scheme:dark]" max={maxMonth} min={minMonth} onChange={(event) => { if (/^\d{4}-\d{2}$/.test(event.target.value)) { setMonth(event.target.value); setSelectedDay(null); } }} type="month" value={visibleMonth} />
          </label>
          <table aria-labelledby="activity-month-title" className="mt-4 w-full table-fixed border-separate border-spacing-1 text-center">
            <thead><tr>{ACTIVITY_WEEKDAYS.map((day) => <th className="pb-2 text-xs font-medium text-slate-400" key={day} scope="col"><abbr className="no-underline" title={day}>{day.slice(0, 3)}</abbr></th>)}</tr></thead>
            <tbody>{Array.from({ length: days.length / 7 }, (_, week) => <tr key={week}>{days.slice(week * 7, week * 7 + 7).map((day, index) => {
              const count = day ? activity.byDay.get(day)?.length ?? 0 : 0;
              const outside = day ? day < range.from || day > range.to : false;
              return <td className="h-12 p-0 sm:h-14" key={day ?? `empty-${index}`}>
                {day ? count ? <button
                  aria-label={`${formatActivityDate(day)}: ${count} ${count === 1 ? "partido" : "partidos"}`}
                  aria-pressed={day === visibleSelectedDay}
                  className={cn("flex h-full w-full flex-col items-center justify-center rounded-lg border text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300", day === visibleSelectedDay ? "border-emerald-300 bg-emerald-300 text-slate-950" : "border-emerald-400/30 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25")}
                  onClick={() => setSelectedDay(day)} type="button"
                ><span>{Number(day.slice(-2))}</span><span aria-hidden="true" className="mt-1 flex gap-0.5">{Array.from({ length: Math.min(count, 3) }, (_, dot) => <span className="h-1 w-1 rounded-full bg-current" key={dot} />)}</span></button>
                  : <span className={cn("flex h-full items-center justify-center rounded-lg text-sm", outside ? "text-slate-600" : "bg-slate-900/40 text-slate-400", day === today && "ring-1 ring-inset ring-slate-500")}>{Number(day.slice(-2))}</span> : null}
              </td>;
            })}</tr>)}</tbody>
          </table>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-400"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-300" />Día con fútbol · Tocá para ver los partidos</div>
          {!monthCount ? <p className="mt-3 text-sm text-slate-400">No hubo partidos finalizados en este mes dentro del período.</p> : null}
        </Card>

        <div className="min-w-0 space-y-4">
          <Card aria-live="polite">
            <CardTitle className="text-base">{visibleSelectedDay ? formatActivityDate(visibleSelectedDay, { weekday: "long", year: undefined }) : "Los partidos de cada día"}</CardTitle>
            {dayMatches.length ? <ul className="mt-3 space-y-2">{dayMatches.map((match) => <li key={match.id}><Link
              className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-3 text-sm transition hover:border-emerald-400/50 hover:bg-slate-800"
              href={buildMatchHistoryHref({ organizationSlug, season, page: historyPage, matchId: match.id, view: "calendar" })}
            ><span><span className="block font-semibold text-slate-100">{match.modality}</span><span className="text-xs text-slate-400">{matchIsoToTimeInput(match.scheduledAt)} hs</span></span><span className="font-semibold text-emerald-300">Ver partido →</span></Link></li>)}</ul>
              : <CardDescription className="mt-2">Elegí un día marcado en el calendario para volver a sus partidos.</CardDescription>}
          </Card>
          <Card>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-300">Su día de cancha</p>
            <p className="mt-2 text-xl font-bold capitalize text-slate-100">{activity.favoriteWeekdays.length ? activity.favoriteWeekdays.join(" · ") : "Todavía sin actividad"}</p>
            <CardDescription className="mt-2">{activity.favoriteWeekdays.length ? "El día de la semana con más partidos en el período elegido." : "Probá ampliar el período para encontrar los partidos del grupo."}</CardDescription>
          </Card>
        </div>
      </div> : null}
    </section>
  );
}
