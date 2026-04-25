import Link from "next/link";
import { redirect } from "next/navigation";

import {
  archiveLeagueAction,
  createLeagueAction,
  deleteLeagueAction
} from "@/app/admin/(panel)/tournaments/actions";
import { LeagueLogo } from "@/components/tournaments/league-logo";
import { TournamentStatusBadge } from "@/components/tournaments/tournament-badges";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { ConfirmSubmitButton } from "@/components/ui/confirm-submit-button";
import { Input } from "@/components/ui/input";
import { TEMP_SKIP_TOURNAMENT_CHECKOUT } from "@/lib/constants";
import { syncTournamentBillingPaymentFromMercadoPago } from "@/lib/domain/tournament-billing-workflow";
import { getAdminLeagueList } from "@/lib/queries/tournaments";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function AdminTournamentsPage({
  searchParams
}: {
  searchParams: Promise<{
    checkout?: string;
    error?: string;
    payment_id?: string;
    success?: string;
  }>;
}) {
  const resolvedSearchParams = await searchParams;

  let checkoutMessage: { tone: "danger" | "success" | "info"; text: string } | null = null;
  if (resolvedSearchParams.payment_id) {
    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      checkoutMessage = {
        tone: "danger",
        text: "Falta SUPABASE_SERVICE_ROLE_KEY para confirmar el pago de la liga."
      };
    } else {
      try {
        const syncResult = await syncTournamentBillingPaymentFromMercadoPago({
          supabase: supabaseAdmin,
          mercadopagoPaymentId: resolvedSearchParams.payment_id
        });

        if (resolvedSearchParams.checkout === "success" && syncResult.updated && syncResult.createdLeagueId) {
          redirect(
            `/admin/tournaments/${syncResult.createdLeagueId}?success=${encodeURIComponent("Liga creada despues de confirmar el pago.")}`
          );
        }

        if (resolvedSearchParams.checkout === "failure") {
          checkoutMessage = {
            tone: "danger",
            text: "El pago no se completo. Puedes intentarlo de nuevo cuando quieras."
          };
        } else if (resolvedSearchParams.checkout === "pending") {
          checkoutMessage = {
            tone: "info",
            text: "El pago quedo pendiente. En cuanto Mercado Pago lo confirme, terminaremos de crear la liga."
          };
        } else if (syncResult.updated && syncResult.status === "approved") {
          checkoutMessage = {
            tone: "success",
            text: "Pago aprobado. Estamos terminando de preparar la liga."
          };
        } else if (!syncResult.updated && "reason" in syncResult && syncResult.reason) {
          checkoutMessage = {
            tone: "danger",
            text: syncResult.reason
          };
        }
      } catch (error) {
        checkoutMessage = {
          tone: "danger",
          text: error instanceof Error ? error.message : "No se pudo confirmar el pago de la liga."
        };
      }
    }
  } else if (resolvedSearchParams.checkout === "failure") {
    checkoutMessage = {
      tone: "danger",
      text: "El pago no se completo. Puedes intentarlo de nuevo cuando quieras."
    };
  } else if (resolvedSearchParams.checkout === "pending") {
    checkoutMessage = {
      tone: "info",
      text: "El pago quedo pendiente. En cuanto Mercado Pago lo confirme, terminaremos de crear la liga."
    };
  }

  const leagues = await getAdminLeagueList();
  const feedbackMessage = resolvedSearchParams.error
    ? { tone: "danger" as const, text: resolvedSearchParams.error }
    : resolvedSearchParams.success
      ? { tone: "success" as const, text: resolvedSearchParams.success }
      : checkoutMessage;

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Ligas</CardTitle>
        <CardDescription>
          Crea y administra ligas con sus equipos maestros, competencias y admins sin mezclar este flujo con Grupos.
        </CardDescription>
        <div className="mt-3">
          <Link className="text-sm font-semibold text-emerald-300 hover:underline" href="/admin/tournaments/billing">
            Ir a facturacion de ligas
          </Link>
        </div>
        {feedbackMessage ? (
          <p
            className={
              feedbackMessage.tone === "danger"
                ? "mt-3 text-sm font-semibold text-danger"
                : feedbackMessage.tone === "success"
                  ? "mt-3 text-sm font-semibold text-emerald-300"
                  : "mt-3 text-sm font-semibold text-sky-300"
            }
          >
            {feedbackMessage.text}
          </p>
        ) : null}
      </Card>

      <Card>
        <CardTitle>Nueva liga</CardTitle>
        <CardDescription className="mt-2">
          {TEMP_SKIP_TOURNAMENT_CHECKOUT
            ? "Carga el nombre de la liga y la creamos al instante. Luego podras cargar equipos, competencias y capitanes opcionales."
            : "Carga el nombre de la liga y te llevamos a Mercado Pago para confirmar el alta antes de habilitar equipos y competencias."}
        </CardDescription>
        <form action={createLeagueAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="name">
              Nombre de la liga
            </label>
            <Input id="name" name="name" placeholder="Ej: LAFAB" required />
          </div>
          <div className="md:self-end">
            <Button type="submit">{TEMP_SKIP_TOURNAMENT_CHECKOUT ? "Crear liga" : "Continuar a Mercado Pago"}</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>Mis ligas</CardTitle>
        <CardDescription>
          Cada liga concentra equipos maestros y una o varias competencias como Viernes A, Viernes B o Copa Clausura.
        </CardDescription>

        <div className="mt-4 space-y-3">
          {leagues.length ? (
            leagues.map((league) => (
              <div
                className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 md:flex-row md:items-center md:justify-between"
                key={league.id}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <LeagueLogo alt={`Logo de ${league.name}`} size={56} src={league.logoUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-slate-100">{league.name}</p>
                      <TournamentStatusBadge status={league.status} />
                    </div>
                    <p className="mt-1 text-sm text-slate-400">/{league.slug}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      {league.isPublic ? "Visible publicamente" : "Solo admin"} · {league.teamCount} equipos · {league.competitionCount} competencias
                    </p>
                    {league.venueName || league.locationNotes ? (
                      <p className="mt-1 text-xs text-slate-400">
                        {league.venueName ? `Sede: ${league.venueName}` : "Sede pendiente"}
                        {league.locationNotes ? ` · ${league.locationNotes}` : ""}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    className="text-sm font-semibold text-emerald-300 hover:underline"
                    href={`/admin/tournaments/${league.id}`}
                  >
                    Gestionar
                  </Link>
                  <Link
                    className="text-sm font-semibold text-sky-300 hover:underline"
                    href={`/tournaments/${league.slug}`}
                  >
                    Ver publica
                  </Link>
                  {league.status !== "archived" ? (
                    <form action={archiveLeagueAction}>
                      <input name="leagueId" type="hidden" value={league.id} />
                      <Button type="submit" variant="ghost">
                        Archivar
                      </Button>
                    </form>
                  ) : null}
                  <form action={deleteLeagueAction}>
                    <input name="leagueId" type="hidden" value={league.id} />
                    <ConfirmSubmitButton
                      className="h-8 px-3 text-xs"
                      confirmMessage={`Seguro que quieres borrar la liga ${league.name}? Antes debe estar sin competencias.`}
                      label="Borrar"
                      variant="ghost"
                    />
                  </form>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">Todavia no administras ninguna liga.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
