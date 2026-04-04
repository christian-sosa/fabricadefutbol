import { AdPlaceholder } from "@/components/layout/ad-placeholder";
import { OrganizationSwitcher } from "@/components/layout/organization-switcher";
import { Card } from "@/components/ui/card";
import { PlayerPhotoModalTrigger } from "@/components/ui/player-photo-modal-trigger";
import { Table, TBody, TD, TH, THead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getPlayersWithStats, getViewerAdminOrganizations, resolvePublicOrganization } from "@/lib/queries/public";

const PODIUM_RANK_STYLES: Record<number, string> = {
  1: "border-amber-300/70 bg-amber-400/20 text-amber-200",
  2: "border-slate-300/70 bg-slate-300/20 text-slate-100",
  3: "border-orange-300/70 bg-orange-400/20 text-orange-200"
};

export default async function RankingPage({
  searchParams
}: {
  searchParams: { org?: string };
}) {
  const [{ organizations, selectedOrganization }, viewerAdminOrganizations] = await Promise.all([
    resolvePublicOrganization(searchParams.org),
    getViewerAdminOrganizations()
  ]);
  const players = await getPlayersWithStats(selectedOrganization?.id ?? null);

  return (
    <div className="-mx-4 min-h-[calc(100vh-6.5rem)] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 py-6 md:rounded-3xl md:border md:border-slate-800 md:p-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-bold uppercase tracking-[0.28em] text-emerald-400">Tabla de Posiciones</p>
          <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
            Ranking Actual {selectedOrganization ? `- ${selectedOrganization.name}` : ""}
          </h1>
        </div>

        <OrganizationSwitcher
          basePath="/ranking"
          currentOrganizationSlug={selectedOrganization?.slug}
          label="Elegir organizacion"
          organizations={organizations}
          quickOrganizations={viewerAdminOrganizations}
        />

        <AdPlaceholder slot="ranking-top" />

        <Card className="overflow-hidden border-slate-800 bg-slate-900/85 p-0 shadow-[0_18px_45px_-20px_rgba(16,185,129,0.55)]">
          <div className="overflow-x-auto">
            <Table className="text-base text-slate-100 md:text-lg">
              <THead className="bg-slate-800/90 text-slate-300">
                <tr>
                  <TH className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400 md:text-sm"># Actual</TH>
                  <TH className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400 md:text-sm">Jugador</TH>
                  <TH className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400 md:text-sm">Rating</TH>
                  <TH className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400 md:text-sm">PJ</TH>
                </tr>
              </THead>
              <TBody className="divide-slate-800">
                {players.map((player, index) => {
                  const rank = index + 1;
                  return (
                    <tr className="transition-colors hover:bg-slate-800/75" key={player.playerId}>
                      <TD className="px-6 py-5">
                        <span
                          className={cn(
                            "inline-flex min-w-[4.5rem] justify-center rounded-full border px-4 py-2 text-base font-black md:text-lg",
                            PODIUM_RANK_STYLES[rank] ?? "border-slate-700 bg-slate-800 text-slate-200"
                          )}
                        >
                          #{rank}
                        </span>
                      </TD>
                      <TD className="px-6 py-5">
                        <PlayerPhotoModalTrigger avatarSize="md" playerId={player.playerId} playerName={player.playerName} />
                      </TD>
                      <TD className="px-6 py-5 text-lg font-semibold text-emerald-300 md:text-xl">{player.currentRating.toFixed(2)}</TD>
                      <TD className="px-6 py-5 text-lg font-medium text-slate-300 md:text-xl">{player.matchesPlayed}</TD>
                    </tr>
                  );
                })}
              </TBody>
            </Table>
          </div>
        </Card>

        <AdPlaceholder slot="ranking-bottom" />
      </div>
    </div>
  );
}
