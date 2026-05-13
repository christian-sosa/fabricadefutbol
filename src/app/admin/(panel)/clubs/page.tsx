import Link from "next/link";
import { redirect } from "next/navigation";

import {
  adminContextActionLinkClass,
  adminContextPrimaryActionLinkClass,
} from "@/components/admin/admin-context-actions";
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <CardTitle>Clubes</CardTitle>
          <Link className={adminContextActionLinkClass} href="/admin">
            Cambiar espacio
          </Link>
        </div>
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
                <div className="flex flex-wrap gap-2">
                  <Link className={adminContextPrimaryActionLinkClass} href={`/admin/clubs/${club.id}`}>
                    Gestionar
                  </Link>
                  <Link className={adminContextActionLinkClass} href={`/clubs/${club.slug}`}>
                    Vista por URL
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
