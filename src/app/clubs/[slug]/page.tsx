import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LeagueLogo } from "@/components/tournaments/league-logo";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { getPublicClubBySlug } from "@/lib/queries/clubs";
import { getClubTeamLogoUrl } from "@/lib/team-logos";
import type { ClubPublicActivity, ClubPublicPlayerStat } from "@/lib/domain/clubs";

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

function getActivityLabel(type: ClubPublicActivity["type"]) {
  switch (type) {
    case "match_played":
      return "Partido";
    case "player_added_to_club":
      return "Jugador";
    case "team_created":
      return "Equipo";
    default:
      return "Club";
  }
}

function PlayerStatsTable({ rows }: { rows: ClubPublicPlayerStat[] }) {
  return (
    <Card>
      <CardTitle>Jugadores destacados</CardTitle>
      <div className="mt-4 overflow-x-auto">
        <Table>
          <THead>
            <tr>
              <TH>Jugador</TH>
              <TH>Equipos</TH>
              <TH>PJ</TH>
              <TH>Asistio</TH>
              <TH>No entro</TH>
              <TH>Goles</TH>
              <TH>Pases gol</TH>
              <TH>Figuras</TH>
              <TH>Ultimo</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map((row) => (
              <tr key={row.playerId}>
                <TD className="font-semibold">{row.name}</TD>
                <TD>{row.teamNames.join(" / ")}</TD>
                <TD>{row.matchesPlayed}</TD>
                <TD>{row.attendances ?? row.matchesPlayed}</TD>
                <TD>{row.presentNotPlayed ?? 0}</TD>
                <TD>{row.goals}</TD>
                <TD>{row.assists}</TD>
                <TD>{row.mvps}</TD>
                <TD>{row.lastMatchDate ? formatDate(row.lastMatchDate) : ""}</TD>
              </tr>
            ))}
          </TBody>
        </Table>
      </div>
    </Card>
  );
}

function RecordCard({ label, row, value }: { label: string; row: ClubPublicPlayerStat; value: number }) {
  return (
    <Card>
      <CardDescription>{label}</CardDescription>
      <CardTitle className="mt-2 text-2xl">{row.name}</CardTitle>
      <p className="mt-2 text-sm font-semibold text-emerald-200">{value}</p>
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
  const hasSummaryData =
    snapshot.summary.teamCount > 0 ||
    snapshot.summary.playerCount > 0 ||
    snapshot.summary.totalMatches > 0;
  const recordRows = [
    snapshot.records.topScorerAllTime
      ? {
          key: "topScorerAllTime",
          label: "Maximo goleador",
          row: snapshot.records.topScorerAllTime,
          value: snapshot.records.topScorerAllTime.goals
        }
      : null,
    snapshot.records.topAssistsAllTime
      ? {
          key: "topAssistsAllTime",
          label: "Maximo asistidor",
          row: snapshot.records.topAssistsAllTime,
          value: snapshot.records.topAssistsAllTime.assists
        }
      : null,
    snapshot.records.mostMvps
      ? {
          key: "mostMvps",
          label: "Mas figuras",
          row: snapshot.records.mostMvps,
          value: snapshot.records.mostMvps.mvps
        }
      : null,
    snapshot.records.mostAttendances
      ? {
          key: "mostAttendances",
          label: "Mas presencias",
          row: snapshot.records.mostAttendances,
          value: snapshot.records.mostAttendances.attendances
        }
      : null,
    snapshot.records.mostMatchesPlayed
      ? {
          key: "mostMatchesPlayed",
          label: "Mas PJ",
          row: snapshot.records.mostMatchesPlayed,
          value: snapshot.records.mostMatchesPlayed.matchesPlayed
        }
      : null
  ].filter(Boolean) as Array<{ key: string; label: string; row: ClubPublicPlayerStat; value: number }>;

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

      {hasSummaryData ? (
        <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <Card>
            <CardDescription>Jugadores</CardDescription>
            <CardTitle className="mt-1 text-3xl">{snapshot.summary.totalPlayersDistinct}</CardTitle>
          </Card>
          <Card>
            <CardDescription>Partidos</CardDescription>
            <CardTitle className="mt-1 text-3xl">{snapshot.summary.totalMatches}</CardTitle>
          </Card>
          <Card>
            <CardDescription>Presentes sin jugar</CardDescription>
            <CardTitle className="mt-1 text-3xl">{snapshot.summary.presentNotPlayedCount ?? 0}</CardTitle>
          </Card>
          <Card>
            <CardDescription>Goles</CardDescription>
            <CardTitle className="mt-1 text-3xl">{snapshot.summary.totalGoals}</CardTitle>
          </Card>
          <Card>
            <CardDescription>Promedio gol</CardDescription>
            <CardTitle className="mt-1 text-3xl">{snapshot.summary.avgGoalsPerMatch}</CardTitle>
          </Card>
          <Card>
            <CardDescription>Primer partido</CardDescription>
            <CardTitle className="mt-1 text-lg">
              {snapshot.summary.firstMatchDate ? formatDate(snapshot.summary.firstMatchDate) : ""}
            </CardTitle>
          </Card>
          <Card>
            <CardDescription>Ultimo partido</CardDescription>
            <CardTitle className="mt-1 text-lg">
              {snapshot.summary.lastMatchDate ? formatDate(snapshot.summary.lastMatchDate) : ""}
            </CardTitle>
          </Card>
        </section>
      ) : null}

      {snapshot.activity.length ? (
        <Card>
          <CardTitle>Actividad reciente</CardTitle>
          <div className="mt-4 space-y-3">
            {snapshot.activity.map((item) => (
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4" key={`${item.type}-${item.entityId}-${item.createdAt}`}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-300">
                      {getActivityLabel(item.type)}
                    </p>
                    <p className="mt-1 font-semibold text-slate-100">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-400">{item.description}</p>
                  </div>
                  <p className="text-sm text-slate-400">{formatDate(item.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {snapshot.teams.length ? (
        <Card>
          <CardTitle>Equipos</CardTitle>
          <div className="mt-4 space-y-3">
            {snapshot.teams.map((team) => (
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4" key={team.id}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <LeagueLogo
                      alt={`Escudo de ${team.name}`}
                      size={48}
                      src={team.logoPath ? getClubTeamLogoUrl(team.id) : null}
                    />
                    <div>
                      <p className="font-semibold text-slate-100">{team.name}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        {team.playerCount} jugadores - {team.matchesPlayed} partidos
                      </p>
                      {team.lastMatchDate ? (
                        <p className="mt-1 text-xs text-slate-500">Ultimo: {formatDate(team.lastMatchDate)}</p>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-left text-sm text-slate-300 sm:text-right">
                    <p>{team.wins} G / {team.draws} E / {team.losses} P</p>
                    <p className="mt-1">{team.goalsFor} GF / {team.goalsAgainst} GC</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {snapshot.playerStats.length ? (
        <PlayerStatsTable rows={snapshot.playerStats.slice(0, 12)} />
      ) : null}

      {recordRows.length ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {recordRows.map((record) => (
            <RecordCard key={record.key} label={record.label} row={record.row} value={record.value} />
          ))}
        </section>
      ) : null}

      {snapshot.competitionStats.length ? (
        <section className="grid gap-4 lg:grid-cols-3">
          {snapshot.competitionStats.map((competition) => (
            <Card key={competition.id ?? competition.name}>
              <CardTitle>{competition.name}</CardTitle>
              <CardDescription className="mt-2">
                {competition.matchesPlayed} partidos - {competition.goalsFor} GF / {competition.goalsAgainst} GC
              </CardDescription>
              <div className="mt-4 space-y-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-200">Goles</p>
                  {competition.topScorers[0] ? (
                    <p className="mt-1 text-slate-400">
                      {competition.topScorers[0].name}: {competition.topScorers[0].value}
                    </p>
                  ) : null}
                </div>
                <div>
                  <p className="font-semibold text-slate-200">Asistencias</p>
                  {competition.topAssisters[0] ? (
                    <p className="mt-1 text-slate-400">
                      {competition.topAssisters[0].name}: {competition.topAssisters[0].value}
                    </p>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </section>
      ) : null}
    </div>
  );
}
