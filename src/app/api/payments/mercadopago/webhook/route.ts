import { NextResponse } from "next/server";

import { syncOrganizationBillingPaymentFromMercadoPago } from "@/lib/domain/billing-workflow";
import { getMercadoPagoWebhookSecret } from "@/lib/env";
import { verifyMercadoPagoWebhookSignature } from "@/lib/payments/mercadopago";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function parsePayload(rawPayload: string) {
  if (!rawPayload.trim()) return {};
  try {
    return JSON.parse(rawPayload) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function getDataId(params: URLSearchParams, payload: Record<string, unknown>) {
  const fromUrl = params.get("data.id");
  if (fromUrl) return fromUrl;
  const fromLegacyUrl = params.get("id");
  if (fromLegacyUrl) return fromLegacyUrl;

  const payloadData = payload.data;
  if (
    payloadData &&
    typeof payloadData === "object" &&
    payloadData !== null &&
    "id" in payloadData
  ) {
    const dataId = (payloadData as { id?: unknown }).id;
    if (typeof dataId === "string" || typeof dataId === "number") {
      return String(dataId);
    }
  }

  if (typeof payload.id === "string" || typeof payload.id === "number") {
    return String(payload.id);
  }

  return null;
}

function getTopic(params: URLSearchParams, payload: Record<string, unknown>) {
  return (
    params.get("type") ??
    params.get("topic") ??
    (typeof payload.type === "string" ? payload.type : null)
  );
}

export async function POST(request: Request) {
  const supabaseAdmin = createSupabaseAdminClient();
  if (!supabaseAdmin) {
    return NextResponse.json(
      {
        error:
          "SUPABASE_SERVICE_ROLE_KEY es requerida para procesar webhooks de Mercado Pago."
      },
      { status: 500 }
    );
  }

  try {
    const rawPayload = await request.text();
    const payload = parsePayload(rawPayload);
    const url = new URL(request.url);
    const topic = getTopic(url.searchParams, payload);
    const dataId = getDataId(url.searchParams, payload);
    const xRequestId = request.headers.get("x-request-id");
    const xSignature = request.headers.get("x-signature");
    const webhookSecret = getMercadoPagoWebhookSecret();

    if (!topic || topic.toLowerCase() !== "payment") {
      return NextResponse.json({ ok: true, skipped: true, reason: "topic_not_supported" });
    }

    if (!dataId) {
      return NextResponse.json({ ok: true, skipped: true, reason: "missing_payment_id" });
    }

    const isProduction = process.env.NODE_ENV === "production";

    if (!webhookSecret) {
      // En produccion exigimos secret para verificar firma; fallar cerrado evita
      // procesamiento de webhooks no autenticados. En dev/local se permite sin
      // secret para facilitar pruebas (mismo comportamiento previo).
      if (isProduction) {
        return NextResponse.json(
          { error: "MERCADOPAGO_WEBHOOK_SECRET no configurado en produccion." },
          { status: 503 }
        );
      }
    } else {
      // Si hay secret configurado, exigimos headers y firma validos.
      // Devolvemos 401 (en lugar de 200 skipped) para que Mercado Pago
      // reintente y no marque el evento como entregado.
      if (!xRequestId || !xSignature) {
        return NextResponse.json(
          { error: "Faltan headers de firma en el webhook." },
          { status: 401 }
        );
      }

      const isSignatureValid = verifyMercadoPagoWebhookSignature({
        secret: webhookSecret,
        dataId: String(dataId),
        requestId: xRequestId,
        signatureHeader: xSignature
      });

      if (!isSignatureValid) {
        return NextResponse.json({ error: "Firma de webhook invalida." }, { status: 401 });
      }
    }

    const syncResult = await syncOrganizationBillingPaymentFromMercadoPago({
      supabase: supabaseAdmin,
      mercadopagoPaymentId: dataId
    });

    return NextResponse.json({
      ok: true,
      topic,
      dataId,
      syncResult
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo procesar webhook de Mercado Pago.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
