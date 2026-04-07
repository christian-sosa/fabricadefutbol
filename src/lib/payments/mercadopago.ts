import crypto from "node:crypto";

import { getMercadoPagoAccessToken } from "@/lib/env";

const MERCADO_PAGO_API_BASE_URL = "https://api.mercadopago.com";

type MercadoPagoRequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  idempotencyKey?: string;
};

async function mercadopagoRequest<TResponse>(
  path: string,
  options: MercadoPagoRequestOptions = {}
): Promise<TResponse> {
  const accessToken = getMercadoPagoAccessToken();
  const response = await fetch(`${MERCADO_PAGO_API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(options.idempotencyKey ? { "X-Idempotency-Key": options.idempotencyKey } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store"
  });

  if (!response.ok) {
    const rawError = await response.text();
    throw new Error(
      `Mercado Pago API error (${response.status}): ${rawError || "sin detalle"}`
    );
  }

  return (await response.json()) as TResponse;
}

export type CreateCheckoutProPreferenceInput = {
  title: string;
  unitPrice: number;
  currencyId: string;
  quantity?: number;
  externalReference: string;
  notificationUrl: string;
  successUrl: string;
  failureUrl: string;
  pendingUrl: string;
  payerEmail?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
};

export type MercadoPagoPreferenceResponse = {
  id: string;
  init_point: string | null;
  sandbox_init_point: string | null;
};

export async function createCheckoutProPreference(
  input: CreateCheckoutProPreferenceInput
): Promise<MercadoPagoPreferenceResponse> {
  const quantity = input.quantity ?? 1;
  const response = await mercadopagoRequest<MercadoPagoPreferenceResponse>("/checkout/preferences", {
    method: "POST",
    idempotencyKey: crypto.randomUUID(),
    body: {
      items: [
        {
          title: input.title,
          quantity,
          currency_id: input.currencyId,
          unit_price: Number(input.unitPrice.toFixed(2))
        }
      ],
      back_urls: {
        success: input.successUrl,
        failure: input.failureUrl,
        pending: input.pendingUrl
      },
      auto_return: "approved",
      notification_url: input.notificationUrl,
      external_reference: input.externalReference,
      payer: input.payerEmail ? { email: input.payerEmail } : undefined,
      metadata: input.metadata ?? undefined
    }
  });

  return {
    id: response.id,
    init_point: response.init_point,
    sandbox_init_point: response.sandbox_init_point
  };
}

export type MercadoPagoPaymentDetails = {
  id: number;
  status: string;
  status_detail?: string | null;
  external_reference?: string | null;
  transaction_amount?: number | null;
  currency_id?: string | null;
  date_created?: string | null;
  date_approved?: string | null;
  payment_type_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function getMercadoPagoPaymentById(paymentId: string | number) {
  return mercadopagoRequest<MercadoPagoPaymentDetails>(`/v1/payments/${paymentId}`);
}

type ParsedMercadoPagoSignature = {
  ts: string;
  v1: string;
};

export function parseMercadoPagoSignatureHeader(
  signatureHeader: string | null | undefined
): ParsedMercadoPagoSignature | null {
  if (!signatureHeader) return null;

  const pairs = signatureHeader.split(",").map((chunk) => chunk.trim());
  const map = new Map<string, string>();
  for (const pair of pairs) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = pair.slice(0, separatorIndex).trim();
    const value = pair.slice(separatorIndex + 1).trim();
    if (!key || !value) continue;
    map.set(key, value);
  }

  const ts = map.get("ts");
  const v1 = map.get("v1");
  if (!ts || !v1) return null;
  return { ts, v1 };
}

export function verifyMercadoPagoWebhookSignature(params: {
  secret: string;
  dataId: string;
  requestId: string;
  signatureHeader: string;
}) {
  const parsedSignature = parseMercadoPagoSignatureHeader(params.signatureHeader);
  if (!parsedSignature) return false;

  const manifest = `id:${params.dataId.toLowerCase()};request-id:${params.requestId};ts:${parsedSignature.ts};`;
  const expectedHex = crypto
    .createHmac("sha256", params.secret)
    .update(manifest)
    .digest("hex");

  const expected = Buffer.from(expectedHex, "utf8");
  const provided = Buffer.from(parsedSignature.v1, "utf8");
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(expected, provided);
}
