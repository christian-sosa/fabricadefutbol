import Link from "next/link";
import { redirect } from "next/navigation";

import { archiveTournamentAction, createTournamentAction } from "@/app/admin/(panel)/tournaments/actions";
import { TournamentStatusBadge } from "@/components/tournaments/tournament-badges";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireAdminSession } from "@/lib/auth/admin";
import { getAdminTournaments } from "@/lib/auth/tournaments";
import { TEMP_SKIP_TOURNAMENT_CHECKOUT } from "@/lib/constants";
import { syncTournamentBillingPaymentFromMercadoPago } from "@/lib/domain/tournament-billing-workflow";
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
  const admin = await requireAdminSession();
  const resolvedSearchParams = await searchParams;

  let checkoutMessage: { tone: "danger" | "success" | "info"; text: string } | null = null;
  if (resolvedSearchParams.payment_id) {
    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      checkoutMessage = {
        tone: "danger",
        text: "Falta SUPABASE_SERVICE_ROLE_KEY para confirmar el pago del torneo."
      };
    } else {
      try {
        const syncResult = await syncTournamentBillingPaymentFromMercadoPago({
          supabase: supabaseAdmin,
          mercadopagoPaymentId: resolvedSearchParams.payment_id
        });

        if (resolvedSearchParams.checkout === "success" && syncResult.updated && syncResult.createdTournamentId) {
          redirect(
            `/admin/tournaments/${syncResult.createdTournamentId}?success=${encodeURIComponent("Torneo creado despues de confirmar el pago.")}`
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
            text: "El pago quedo pendiente. En cuanto Mercado Pago lo confirme, terminaremos de crear el torneo."
          };
        } else if (syncResult.updated && syncResult.status === "approved") {
          checkoutMessage = {
            tone: "success",
            text: "Pago aprobado. Estamos terminando de preparar el torneo."
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
          text: error instanceof Error ? error.message : "No se pudo confirmar el pago del torneo."
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
      text: "El pago quedo pendiente. En cuanto Mercado Pago lo confirme, terminaremos de crear el torneo."
    };
  }

  const tournaments = await getAdminTournaments(admin);
  const feedbackMessage = resolvedSearchParams.error
    ? { tone: "danger" as const, text: resolvedSearchParams.error }
    : resolvedSearchParams.success
      ? { tone: "success" as const, text: resolvedSearchParams.success }
      : checkoutMessage;

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>Torneos</CardTitle>
        <CardDescription>
          Crea y administra ligas, torneos o subtorneos independientes del flujo actual de grupos.
        </CardDescription>
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
        <CardTitle>Nuevo torneo o subtorneo</CardTitle>
        <CardDescription className="mt-2">
          {TEMP_SKIP_TOURNAMENT_CHECKOUT
            ? "Ingresa un nombre unico y lo creamos directo. El cobro de torneos esta temporalmente simulado para debug."
            : "Ingresa un nombre unico y te llevamos a Mercado Pago para confirmar el alta antes de habilitar el torneo."}
        </CardDescription>
        <form action={createTournamentAction} className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-200" htmlFor="name">
              Nombre
            </label>
            <Input id="name" name="name" placeholder="Viernes A1" required />
          </div>
          <div className="md:self-end">
            <Button type="submit">{TEMP_SKIP_TOURNAMENT_CHECKOUT ? "Crear torneo" : "Continuar a Mercado Pago"}</Button>
          </div>
        </form>
      </Card>

      <Card>
        <CardTitle>Mis torneos</CardTitle>
        <CardDescription>Entra a cada torneo o subtorneo para cargar equipos, planteles, fixture y resultados.</CardDescription>

        <div className="mt-4 space-y-3">
          {tournaments.length ? (
            tournaments.map((tournament) => (
              <div
                className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-950/70 p-4 md:flex-row md:items-center md:justify-between"
                key={tournament.id}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-slate-100">{tournament.name}</p>
                    <TournamentStatusBadge status={tournament.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-400">/{tournament.slug}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {tournament.is_public ? "Visible publicamente" : "Solo admin"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Link
                    className="text-sm font-semibold text-emerald-300 hover:underline"
                    href={`/admin/tournaments/${tournament.id}`}
                  >
                    Gestionar
                  </Link>
                  <Link
                    className="text-sm font-semibold text-sky-300 hover:underline"
                    href={`/tournaments/${tournament.slug}`}
                  >
                    Ver publico
                  </Link>
                  {tournament.status !== "archived" ? (
                    <form action={archiveTournamentAction}>
                      <input name="tournamentId" type="hidden" value={tournament.id} />
                      <Button type="submit" variant="ghost">
                        Archivar
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400">Todavia no administras ningun torneo.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
