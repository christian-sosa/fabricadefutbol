import Link from "next/link";
import { notFound } from "next/navigation";

import { TournamentFixtureTable } from "@/components/tournaments/tournament-fixture-table";
import { TournamentStatusBadge } from "@/components/tournaments/tournament-badges";
import { TournamentStandingsTable } from "@/components/tournaments/tournament-standings-table";
import { TournamentTabs } from "@/components/tournaments/tournament-tabs";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { getPublicTournamentBySlug } from "@/lib/queries/tournaments";

function buildTabHref(slug: string, tab: string) {
  return `/tournaments/${slug}?tab=${encodeURIComponent(tab)}`;
}

export default async function TournamentDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const data = await getPublicTournamentBySlug(slug);
  if (!data) notFound();

  const selectedTab = resolvedSearchParams.tab ?? "table";
  const tabs = [
    { key: "table", label: "Tabla" },
    { key: "fixture", label: "Fixture" },
    { key: "scorers", label: "Goleadores" },
    { key: "mvps", label: "Figuras" },
    { key: "defense", label: "Vallas" }
  ];

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{data.tournament.name}</CardTitle>
              <TournamentStatusBadge status={data.tournament.status} />
            </div>
            <CardDescription className="mt-2">
              {data.tournament.seasonLabel} - {data.tournament.description || "Sin descripcion"}
            </CardDescription>
            <p className="mt-2 text-xs text-slate-500">
              {data.tournament.isPublic ? "Torneo publico" : "Solo lectura admin"}
            </p>
          </div>
          <Link className="text-sm font-semibold text-slate-300 hover:underline" href="/tournaments">
            Volver al listado
          </Link>
        </div>
      </Card>

      <Card>
        <TournamentTabs
          items={tabs.map((tab) => ({
            href: buildTabHref(slug, tab.key),
            label: tab.label,
            active: selectedTab === tab.key
          }))}
        />
      </Card>

      {selectedTab === "table" ? (
        <Card>
          <CardTitle>Tabla de posiciones</CardTitle>
          <div className="mt-4">
            <TournamentStandingsTable rows={data.standings} />
          </div>
        </Card>
      ) : null}

      {selectedTab === "fixture" ? (
        <Card>
          <CardTitle>Fixture</CardTitle>
          <div className="mt-4">
            <TournamentFixtureTable
              buildMatchHref={(row) => `/tournaments/${slug}/matches/${row.id}`}
              linkLabel="Detalle"
              rows={data.fixture}
            />
          </div>
        </Card>
      ) : null}

      {selectedTab === "scorers" ? (
        <Card>
          <CardTitle>Goleadores</CardTitle>
          <div className="mt-4 overflow-x-auto">
            <Table>
              <THead>
                <tr>
                  <TH>Jugador</TH>
                  <TH>Equipo</TH>
                  <TH>Goles</TH>
                </tr>
              </THead>
              <TBody>
                {data.topScorers.map((row) => (
                  <tr className="transition-colors hover:bg-slate-800/70" key={`${row.teamId}:${row.playerId ?? row.playerName}`}>
                    <TD className="font-semibold text-slate-100">{row.playerName}</TD>
                    <TD>{row.teamName}</TD>
                    <TD>{row.goals}</TD>
                  </tr>
                ))}
                {!data.topScorers.length ? (
                  <tr>
                    <TD className="py-6 text-sm text-slate-400" colSpan={3}>
                      Todavia no hay goles cargados.
                    </TD>
                  </tr>
                ) : null}
              </TBody>
            </Table>
          </div>
        </Card>
      ) : null}

      {selectedTab === "mvps" ? (
        <Card>
          <CardTitle>Figuras del partido</CardTitle>
          <div className="mt-4 overflow-x-auto">
            <Table>
              <THead>
                <tr>
                  <TH>Jugador</TH>
                  <TH>Equipo</TH>
                  <TH>Figuras</TH>
                </tr>
              </THead>
              <TBody>
                {data.topFigures.map((row) => (
                  <tr className="transition-colors hover:bg-slate-800/70" key={`${row.teamId}:${row.playerId ?? row.playerName}`}>
                    <TD className="font-semibold text-slate-100">{row.playerName}</TD>
                    <TD>{row.teamName}</TD>
                    <TD>{row.mvpCount}</TD>
                  </tr>
                ))}
                {!data.topFigures.length ? (
                  <tr>
                    <TD className="py-6 text-sm text-slate-400" colSpan={3}>
                      Todavia no hay figuras cargadas.
                    </TD>
                  </tr>
                ) : null}
              </TBody>
            </Table>
          </div>
        </Card>
      ) : null}

      {selectedTab === "defense" ? (
        <Card>
          <CardTitle>Vallas menos vencidas</CardTitle>
          <div className="mt-4 overflow-x-auto">
            <Table>
              <THead>
                <tr>
                  <TH>Equipo</TH>
                  <TH>GC</TH>
                  <TH>PJ</TH>
                </tr>
              </THead>
              <TBody>
                {data.bestDefense.map((row) => (
                  <tr className="transition-colors hover:bg-slate-800/70" key={row.teamId}>
                    <TD className="font-semibold text-slate-100">{row.teamName}</TD>
                    <TD>{row.goalsAgainst}</TD>
                    <TD>{row.matchesPlayed}</TD>
                  </tr>
                ))}
                {!data.bestDefense.length ? (
                  <tr>
                    <TD className="py-6 text-sm text-slate-400" colSpan={3}>
                      Todavia no hay partidos jugados.
                    </TD>
                  </tr>
                ) : null}
              </TBody>
            </Table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
