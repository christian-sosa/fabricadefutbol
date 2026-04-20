import crypto from "node:crypto";

import { getMercadoPagoAccessToken } from "@/lib/env";

const MERCADO_PAGO_API_BASE_URL = "https://api.mercadopago.com";
const MERCADO_PAGO_REQUEST_TIMEOUT_MS = 10_000;
const MERCADO_PAGO_MAX_RETRIES = 2;

type MercadoPagoRequestOptions = {
  method?: "GET" | "POST";
  body?: unknown;
  idempotencyKey?: string;
};

function shouldRetryStatus(status: number) {
  return status === 429 || status >= 500;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mercadopagoRequest<TResponse>(
  path: string,
  options: MercadoPagoRequestOptions = {}
): Promise<TResponse> {
  const accessToken = getMercadoPagoAccessToken();
  const method = options.method ?? "GET";
  // Solo reintenta metodos idempotentes (GET) o con idempotency key explicita.
  // Un POST sin idempotencyKey podria crear recursos duplicados.
  const canRetry = method === "GET" || Boolean(options.idempotencyKey);
  const maxAttempts = canRetry ? MERCADO_PAGO_MAX_RETRIES + 1 : 1;

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${MERCADO_PAGO_API_BASE_URL}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          ...(options.idempotencyKey ? { "X-Idempotency-Key": options.idempotencyKey } : {})
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(MERCADO_PAGO_REQUEST_TIMEOUT_MS)
      });

      if (!response.ok) {
        if (attempt < maxAttempts && shouldRetryStatus(response.status)) {
          // Backoff exponencial suave: 250ms, 500ms, 1000ms...
          await sleep(250 * 2 ** (attempt - 1));
          continue;
        }
        const rawError = await response.text();
        throw new Error(
          `Mercado Pago API error (${response.status}): ${rawError || "sin detalle"}`
        );
      }

      return (await response.json()) as TResponse;
    } catch (error) {
      lastError = error;
      // Reintenta errores de red / timeout solo si el metodo es seguro.
      const isAbort =
        error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError");
      if (attempt < maxAttempts && canRetry && isAbort) {
        await sleep(250 * 2 ** (attempt - 1));
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Mercado Pago API error: sin respuesta.");
}

export type CreateCheckoutProPreferenceInput = {
  title: string;
  unitPrice: number;
  currencyId: string;
  quantity?: number;
  expiresAt?: string | null;
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
      ...(input.expiresAt
        ? {
            expires: true,
            expiration_date_from: new Date().toISOString(),
            expiration_date_to: input.expiresAt
          }
        : {}),
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

// Tolerancia maxima entre el timestamp del webhook y el reloj del servidor
// para mitigar replays de requests firmados antiguos.
const MERCADO_PAGO_SIGNATURE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutos

export function verifyMercadoPagoWebhookSignature(params: {
  secret: string;
  dataId: string;
  requestId: string;
  signatureHeader: string;
  /** Reloj inyectable para tests; en runtime usa Date.now(). */
  now?: number;
}) {
  const parsedSignature = parseMercadoPagoSignatureHeader(params.signatureHeader);
  if (!parsedSignature) return false;

  const tsNumber = Number(parsedSignature.ts);
  if (Number.isFinite(tsNumber) && tsNumber > 0) {
    const now = params.now ?? Date.now();
    // El ts viene en milisegundos segun spec actual de MP; si se enviara en
    // segundos, el delta seria enorme y caeria igual al fallback del return.
    const tsMs = tsNumber > 1_000_000_000_000 ? tsNumber : tsNumber * 1000;
    if (Math.abs(now - tsMs) > MERCADO_PAGO_SIGNATURE_MAX_AGE_MS) {
      return false;
    }
  }

  const manifest = `id:${params.dataId.toLowerCase()};request-id:${params.requestId};ts:${parsedSignature.ts};`;
  const expectedHex = crypto
    .createHmac("sha256", params.secret)
    .update(manifest)
    .digest("hex");

  // MP devuelve v1 en hex; normalizamos a minusculas para evitar falsos negativos
  // si en algun ambiente llegara en mayusculas.
  const providedHex = parsedSignature.v1.toLowerCase();
  const expected = Buffer.from(expectedHex, "utf8");
  const provided = Buffer.from(providedHex, "utf8");
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(expected, provided);
}
