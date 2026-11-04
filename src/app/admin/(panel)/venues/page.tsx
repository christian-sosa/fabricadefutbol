import { AdminCurrentGroupCard } from "@/components/admin/admin-current-group-card";
import { ActionForm } from "@/components/ui/action-form";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { FormSubmitButton } from "@/components/ui/form-submit-button";
import { Input } from "@/components/ui/input";
import { requireAdminOrganization } from "@/lib/auth/admin";
import { readAllRows } from "@/lib/supabase/pagination";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { saveVenueAction, setVenueArchivedAction } from "./actions";
import { MAX_ACTIVE_VENUES, MAX_VENUE_NAME_LENGTH } from "./limits";

type Venue = { id: string; name: string; archived_at: string | null };

export default async function AdminVenuesPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org } = await searchParams;
  const { admin, selectedOrganization } = await requireAdminOrganization(org);
  const supabase = await createSupabaseServerClient();
  const organizationId = selectedOrganization.id;
  const venues = await readAllRows<Venue>((from, to) => supabase.from("organization_venues")
    .select("id, name, archived_at").eq("organization_id", organizationId)
    .order("name").order("id").range(from, to));
  const activeVenues = venues.filter((venue) => !venue.archived_at);
  const archivedVenues = venues.filter((venue) => venue.archived_at);
  const isFull = activeVenues.length >= MAX_ACTIVE_VENUES;

  return (
    <div className="space-y-4">
      <AdminCurrentGroupCard admin={admin} organization={selectedOrganization} />
      <Card>
        <CardTitle>Canchas</CardTitle>
        <CardDescription className="mt-1">Guardá las canchas del grupo para elegirlas al cargar un partido.</CardDescription>
        <p className="mt-2 text-sm font-semibold text-slate-200">{activeVenues.length} de {MAX_ACTIVE_VENUES} canchas activas</p>
        {isFull ? <p className="mt-2 text-sm text-amber-200">Archivá una cancha para liberar un cupo.</p> : (
          <ActionForm action={saveVenueAction.bind(null, organizationId, null)} className="mt-4 grid max-w-lg gap-2 sm:grid-cols-[1fr_auto]">
            <label className="grid gap-1 text-sm font-semibold text-slate-200">
              Nombre de la cancha
              <Input maxLength={MAX_VENUE_NAME_LENGTH} name="name" placeholder="Ej. Cancha del barrio" required />
            </label>
            <FormSubmitButton className="self-end" pendingLabel="Agregando…">Agregar cancha</FormSubmitButton>
          </ActionForm>
        )}
      </Card>

      <Card>
        <CardTitle>Canchas activas</CardTitle>
        <CardDescription className="mt-1">Al archivar una cancha, deja de aparecer al crear partidos y queda guardada en el historial.</CardDescription>
        {activeVenues.length ? (
          <ul className="mt-3 divide-y divide-slate-800">
            {activeVenues.map((venue) => (
              <li className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto]" key={venue.id}>
                <ActionForm action={saveVenueAction.bind(null, organizationId, venue.id)} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2" key={venue.name}>
                  <Input aria-label={`Nombre de ${venue.name}`} defaultValue={venue.name} maxLength={MAX_VENUE_NAME_LENGTH} name="name" required />
                  <FormSubmitButton aria-label={`Guardar nombre de ${venue.name}`} pendingLabel="Guardando…" variant="secondary">Guardar</FormSubmitButton>
                </ActionForm>
                <ActionForm action={setVenueArchivedAction.bind(null, organizationId, venue.id, true)} className="space-y-2">
                  <FormSubmitButton aria-label={`Archivar ${venue.name}`} pendingLabel="Archivando…" variant="secondary">Archivar</FormSubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 text-sm text-slate-400">Todavía no hay canchas activas.</p>}
      </Card>

      {archivedVenues.length ? (
        <Card>
          <details>
            <summary className="min-h-11 cursor-pointer content-center font-semibold text-slate-100">Canchas archivadas ({archivedVenues.length})</summary>
            <ul className="mt-2 divide-y divide-slate-800">
              {archivedVenues.map((venue) => (
                <li className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto]" key={venue.id}>
                  <p className="self-center break-words text-sm text-slate-200">{venue.name}</p>
                  <ActionForm action={setVenueArchivedAction.bind(null, organizationId, venue.id, false)} className="space-y-2">
                    <FormSubmitButton aria-label={`Restaurar ${venue.name}`} disabled={isFull} pendingLabel="Restaurando…" variant="secondary">Restaurar</FormSubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          </details>
        </Card>
      ) : null}
    </div>
  );
}
