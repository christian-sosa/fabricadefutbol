import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { getPublicClubBySlug } from "@/lib/queries/clubs";

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPublicClubBySlug(slug);

  return {
    title: data ? data.club.name : "Club",
    robots: {
      index: false,
      follow: false
    }
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeZone: "America/Buenos_Aires"
  }).format(new Date(value));
}

function StatTable({
  emptyText,
  label,
  rows
}: {
  emptyText: string;
  label: string;
  rows: Array<{ name: string; teamName: string; value: number }>;
}) {
  return (
    <Card>
      <CardTitle>{label}</CardTitle>
      <div className="mt-4 overflow-x-auto">
        {rows.length ? (
          <Table>
            <THead>
              <tr>
                <TH>Jugador</TH>
                <TH>Equipo</TH>
                <TH>Total</TH>
              </tr>
            </THead>
            <TBody>
              {rows.map((row) => (
                <tr key={`${row.name}-${row.teamName}`}>
                  <TD className="font-semibold">{row.name}</TD>
                  <TD>{row.teamName}</TD>
                  <TD className="font-black text-white">{row.value}</TD>
                </tr>
              ))}
            </TBody>
          </Table>
        ) : (
          <p className="text-sm text-slate-400">{emptyText}</p>
        )}
      </div>
    </Card>
  );
}

export default async function PublicClubPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getPublicClubBySlug(slug);
  if (!data) notFound();

  const { club, snapshot } = data;

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-800 bg-slate-950/80 p-5 shadow-[0_24px_70px_-48px_rgba(16,185,129,0.9)] sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">Club</p>
            <h1 className="mt-2 text-4xl font-black text-white sm:text-5xl">{club.name}</h1>
            {club.description ? (
              <p className="mt-3 max-w-3xl text-base text-slate-300">{club.description}</p>
            ) : null}
          </div>
          {club.home_venue ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-sm text-slate-300">
              <span className="font-semibold text-slate-100">Sede:</span> {club.home_venue}
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardDescription>Equipos</CardDescription>
          <CardTitle className="mt-1 text-3xl">{snapshot.summary.teamCount}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Jugadores</CardDescription>
          <CardTitle className="mt-1 text-3xl">{snapshot.summary.playerCount}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Partidos</CardDescription>
          <CardTitle className="mt-1 text-3xl">{snapshot.summary.playedMatches}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Goles a favor</CardDescription>
          <CardTitle className="mt-1 text-3xl">{snapshot.summary.goalsFor}</CardTitle>
        </Card>
        <Card>
          <CardDescription>Goles en contra</CardDescription>
          <CardTitle className="mt-1 text-3xl">{snapshot.summary.goalsAgainst}</CardTitle>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardTitle>Equipos</CardTitle>
          <div className="mt-4 space-y-3">
            {snapshot.teams.length ? (
              snapshot.teams.map((team) => (
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4" key={team.id}>
                  <p className="font-semibold text-slate-100">{team.name}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {team.playerCount} jugadores - {team.matchesPlayed} partidos
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">Todavia no hay equipos publicados.</p>
            )}
          </div>
        </Card>

        <Card>
          <CardTitle>Ultimos partidos</CardTitle>
          <div className="mt-4 space-y-3">
            {snapshot.recentMatches.length ? (
              snapshot.recentMatches.map((match) => (
                <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4" key={match.id}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-100">
                        {match.teamName} vs {match.opponentName}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {formatDate(match.playedAt)}
                        {match.venue ? ` - ${match.venue}` : ""}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                        {match.competitionName}
                      </p>
                    </div>
                    <p className="text-2xl font-black text-white">
                      {match.goalsFor} - {match.goalsAgainst}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-400">Todavia no hay partidos publicados.</p>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <StatTable emptyText="Sin goles cargados." label="Goleadores" rows={snapshot.topScorers} />
        <StatTable emptyText="Sin asistencias cargadas." label="Asistidores" rows={snapshot.topAssisters} />
        <StatTable emptyText="Sin figuras cargadas." label="Figuras" rows={snapshot.topFigures} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {snapshot.competitionStats.length ? (
          snapshot.competitionStats.map((competition) => (
            <Card key={competition.id ?? competition.name}>
              <CardTitle>{competition.name}</CardTitle>
              <CardDescription className="mt-2">
                {competition.matchesPlayed} partidos - {competition.goalsFor} GF / {competition.goalsAgainst} GC
              </CardDescription>
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-200">Goles</p>
                  <p className="mt-1 text-slate-400">
                    {competition.topScorers[0]
                      ? `${competition.topScorers[0].name}: ${competition.topScorers[0].value}`
                      : "Sin goles"}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-slate-200">Asistencias</p>
                  <p className="mt-1 text-slate-400">
                    {competition.topAssisters[0]
                      ? `${competition.topAssisters[0].name}: ${competition.topAssisters[0].value}`
                      : "Sin asistencias"}
                  </p>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card>
            <CardTitle>Torneos</CardTitle>
            <CardDescription className="mt-2">Todavia no hay partidos clasificados.</CardDescription>
          </Card>
        )}
      </section>
    </div>
  );
}
