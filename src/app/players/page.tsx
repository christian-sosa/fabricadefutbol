import { PlayersStatsTable } from "@/components/players/players-stats-table";
import { Card } from "@/components/ui/card";
import { getPlayersWithStats } from "@/lib/queries/public";

export default async function PlayersPage() {
  const players = await getPlayersWithStats();

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-black text-slate-100">Jugadores</h1>
      <Card>
        <PlayersStatsTable players={players} />
      </Card>
    </div>
  );
}
