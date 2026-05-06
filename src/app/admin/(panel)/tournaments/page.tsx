import { redirect } from "next/navigation";

import { syncTournamentBillingPaymentFromMercadoPago } from "@/lib/domain/tournament-billing-workflow";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AdminTournamentsSearchParams = {
  checkout?: string;
  error?: string;
  payment_id?: string;
  success?: string;
};

function buildAdminHubPath(params?: { error?: string; success?: string }) {
  const searchParams = new URLSearchParams();
  if (params?.error) searchParams.set("error", params.error);
  if (params?.success) searchParams.set("success", params.success);
  const query = searchParams.toString();
  return query ? `/admin?${query}` : "/admin";
}

function buildLeagueDetailPath(leagueId: string, success: string) {
  const searchParams = new URLSearchParams({ success });
  return `/admin/tournaments/${leagueId}?${searchParams.toString()}`;
}

export default async function AdminTournamentsPage({
  searchParams
}: {
  searchParams: Promise<AdminTournamentsSearchParams>;
}) {
  const resolvedSearchParams = await searchParams;

  if (resolvedSearchParams.error) {
    redirect(buildAdminHubPath({ error: resolvedSearchParams.error }));
  }

  if (resolvedSearchParams.success) {
    redirect(buildAdminHubPath({ success: resolvedSearchParams.success }));
  }

  if (resolvedSearchParams.payment_id) {
    const supabaseAdmin = createSupabaseAdminClient();
    if (!supabaseAdmin) {
      redirect(buildAdminHubPath({ error: "Falta SUPABASE_SERVICE_ROLE_KEY para confirmar el pago de la liga." }));
    }

    let detailRedirectPath: string | null = null;
    let hubMessage: { tone: "error" | "success"; text: string } | null = null;

    try {
      const syncResult = await syncTournamentBillingPaymentFromMercadoPago({
        supabase: supabaseAdmin,
        mercadopagoPaymentId: resolvedSearchParams.payment_id
      });

      if (syncResult.updated && syncResult.createdLeagueId) {
        detailRedirectPath = buildLeagueDetailPath(syncResult.createdLeagueId, "Liga creada despues de confirmar el pago.");
      } else if (resolvedSearchParams.checkout === "failure") {
        hubMessage = {
          tone: "error",
          text: "El pago no se completo. Puedes intentarlo de nuevo cuando quieras."
        };
      } else if (resolvedSearchParams.checkout === "pending") {
        hubMessage = {
          tone: "success",
          text: "El pago quedo pendiente. En cuanto Mercado Pago lo confirme, terminaremos de crear la liga."
        };
      } else if (syncResult.updated && syncResult.status === "approved") {
        hubMessage = {
          tone: "success",
          text: "Pago aprobado. Estamos terminando de preparar la liga."
        };
      } else if (!syncResult.updated && "reason" in syncResult && syncResult.reason) {
        hubMessage = {
          tone: "error",
          text: syncResult.reason
        };
      }
    } catch (error) {
      hubMessage = {
        tone: "error",
        text: error instanceof Error ? error.message : "No se pudo confirmar el pago de la liga."
      };
    }

    if (detailRedirectPath) {
      redirect(detailRedirectPath);
    }

    if (hubMessage?.tone === "error") {
      redirect(buildAdminHubPath({ error: hubMessage.text }));
    }

    if (hubMessage?.tone === "success") {
      redirect(buildAdminHubPath({ success: hubMessage.text }));
    }
  }

  if (resolvedSearchParams.checkout === "failure") {
    redirect(buildAdminHubPath({ error: "El pago no se completo. Puedes intentarlo de nuevo cuando quieras." }));
  }

  if (resolvedSearchParams.checkout === "pending") {
    redirect(buildAdminHubPath({ success: "El pago quedo pendiente. En cuanto Mercado Pago lo confirme, terminaremos de crear la liga." }));
  }

  if (resolvedSearchParams.checkout === "success") {
    redirect(buildAdminHubPath({ success: "Pago aprobado. Estamos terminando de preparar la liga." }));
  }

  redirect("/admin");
}
