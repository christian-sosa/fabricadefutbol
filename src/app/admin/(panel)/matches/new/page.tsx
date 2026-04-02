import { NewMatchForm } from "@/components/admin/new-match-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getSelectablePlayers } from "@/lib/queries/admin";

export default async function NewMatchPage({
  searchParams
}: {
  searchParams: { error?: string };
}) {
  const players = await getSelectablePlayers();
  const error = searchParams.error;

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Crear partido</CardTitle>
        <CardDescription>
          1) Elige modalidad, 2) selecciona jugadores fijos e invitados, 3) el sistema genera opciones balanceadas.
        </CardDescription>

        <NewMatchForm error={error} players={players} />
      </Card>
    </div>
  );
}
