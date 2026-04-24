import Link from "next/link";

import { AdPlaceholder } from "@/components/layout/ad-placeholder";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { PlayerAvatar } from "@/components/ui/player-avatar";
import { withOrgQuery } from "@/lib/org";
import { getUpcomingConfirmedMatches, getViewerAdminOrganizations, resolvePublicOrganization } from "@/lib/queries/public";
import { formatDateTime } from "@/lib/utils";

export default async function UpcomingPage({
  searchParams
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const [{ organizations, selectedOrganization }, viewerAdminOrganizations] = await Promise.all([
    resolvePublicOrganization(resolvedSearchParams.org),
    getViewerAdminOrganizations()
  ]);
  const upcoming = await getUpcomingConfirmedMatches(selectedOrganization?.id ?? null);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black text-slate-100">
        Proximos Partidos Confirmados {selectedOrganization ? `- ${selectedOrganization.name}` : ""}
      </h1>

      <OrganizationSwitcher
        basePath="/upcoming"
        currentOrganizationSlug={selectedOrganization?.slug}
        label="Elegir grupo"
        organizations={organizations}
        quickOrganizations={viewerAdminOrganizations}
      />

      <AdPlaceholder slot="upcoming-top" />

      {upcoming.length ? (
        <div className="space-y-4">
          {upcoming.map((item) => (
            <Card key={item.match.id}>
              <CardTitle>
                {item.match.modality} - {formatDateTime(item.match.scheduled_at)}
              </CardTitle>
              <CardDescription>{item.match.location || "Sin ubicacion definida"}</CardDescription>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Equipo A</p>
                  <ul className="space-y-2 text-sm">
                    {item.teamAPlayers.map((player) => (
                      <li className="flex items-center justify-between gap-3" key={player.id}>
                        <div className="flex items-center gap-2">
                          <PlayerAvatar name={player.full_name} playerId={player.is_guest ? undefined : player.id} size="sm" />
                          <span className="flex items-center gap-2">
                            {player.full_name}
                            {player.is_guest ? (
                              <span className="rounded-full border border-cyan-400/50 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
                                Invitado
                              </span>
                            ) : null}
                          </span>
                        </div>
                        {!player.is_guest ? <span className="font-semibold text-emerald-300">{Number(player.current_rating).toFixed(2)}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Equipo B</p>
                  <ul className="space-y-2 text-sm">
                    {item.teamBPlayers.map((player) => (
                      <li className="flex items-center justify-between gap-3" key={player.id}>
                        <div className="flex items-center gap-2">
                          <PlayerAvatar name={player.full_name} playerId={player.is_guest ? undefined : player.id} size="sm" />
                          <span className="flex items-center gap-2">
                            {player.full_name}
                            {player.is_guest ? (
                              <span className="rounded-full border border-cyan-400/50 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan-200">
                                Invitado
                              </span>
                            ) : null}
                          </span>
                        </div>
                        {!player.is_guest ? <span className="font-semibold text-emerald-300">{Number(player.current_rating).toFixed(2)}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <Link
                className="mt-4 inline-flex text-sm font-semibold text-emerald-300 hover:underline"
                href={withOrgQuery(`/matches/${item.match.id}`, selectedOrganization?.slug)}
              >
                Ver detalle completo
              </Link>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardDescription>No hay proximos partidos confirmados.</CardDescription>
        </Card>
      )}
    </div>
  );
}
