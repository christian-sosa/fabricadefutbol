import Link from "next/link";
import { redirect } from "next/navigation";

import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { getAdminClubList } from "@/lib/queries/clubs";

export default async function AdminClubsPage() {
  const clubs = await getAdminClubList();

  if (clubs.length === 1) {
    redirect(`/admin/clubs/${clubs[0].id}`);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Clubes</CardTitle>
        <CardDescription className="mt-2">
          POC oculta para administrar clubes, equipos internos, pool de jugadores y partidos 11 vs 11.
        </CardDescription>
      </Card>

      <div className="space-y-3">
        {clubs.length ? (
          clubs.map((club) => (
            <Card key={club.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle>{club.name}</CardTitle>
                  <CardDescription className="mt-1">
                    /clubs/{club.slug} - {club.status === "active" ? "Activo" : "Oculto"}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Link className="text-sm font-semibold text-emerald-300 hover:underline" href={`/admin/clubs/${club.id}`}>
                    Gestionar
                  </Link>
                  <Link className="text-sm font-semibold text-sky-300 hover:underline" href={`/clubs/${club.slug}`}>
                    Ver publica
                  </Link>
                </div>
              </div>
            </Card>
          ))
        ) : (
          <Card>
            <CardDescription>No administras clubes todavia.</CardDescription>
          </Card>
        )}
      </div>
    </div>
  );
}
