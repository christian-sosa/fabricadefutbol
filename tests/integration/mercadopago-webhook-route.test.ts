import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  syncOrganizationBillingPaymentFromMercadoPagoMock,
  syncTournamentBillingPaymentFromMercadoPagoMock,
  getMercadoPagoWebhookSecretMock,
  verifyMercadoPagoWebhookSignatureMock,
  createSupabaseAdminClientMock
} = vi.hoisted(() => ({
  syncOrganizationBillingPaymentFromMercadoPagoMock: vi.fn(),
  syncTournamentBillingPaymentFromMercadoPagoMock: vi.fn(),
  getMercadoPagoWebhookSecretMock: vi.fn(),
  verifyMercadoPagoWebhookSignatureMock: vi.fn(),
  createSupabaseAdminClientMock: vi.fn()
}));

vi.mock("@/lib/domain/billing-workflow", () => ({
  syncOrganizationBillingPaymentFromMercadoPago:
    syncOrganizationBillingPaymentFromMercadoPagoMock
}));

vi.mock("@/lib/domain/tournament-billing-workflow", () => ({
  syncTournamentBillingPaymentFromMercadoPago:
    syncTournamentBillingPaymentFromMercadoPagoMock
}));

vi.mock("@/lib/env", () => ({
  getMercadoPagoWebhookSecret: getMercadoPagoWebhookSecretMock
}));

vi.mock("@/lib/payments/mercadopago", () => ({
  verifyMercadoPagoWebhookSignature: verifyMercadoPagoWebhookSignatureMock
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: createSupabaseAdminClientMock
}));

import { POST } from "@/app/api/payments/mercadopago/webhook/route";

describe("Mercado Pago webhook route", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    createSupabaseAdminClientMock.mockReset();
    syncOrganizationBillingPaymentFromMercadoPagoMock.mockReset();
    syncTournamentBillingPaymentFromMercadoPagoMock.mockReset();
    getMercadoPagoWebhookSecretMock.mockReset();
    verifyMercadoPagoWebhookSignatureMock.mockReset();

    createSupabaseAdminClientMock.mockReturnValue({ role: "service-role" });
    syncOrganizationBillingPaymentFromMercadoPagoMock.mockResolvedValue({
      updated: true,
      organizationId: "org-1"
    });
    syncTournamentBillingPaymentFromMercadoPagoMock.mockResolvedValue({
      updated: true,
      createdTournamentId: "tournament-1"
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ignora topics que no son de payment", async () => {
    const response = await POST(
      new Request("https://example.com/api/payments/mercadopago/webhook?topic=merchant_order", {
        method: "POST",
        body: JSON.stringify({})
      })
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      skipped: true,
      reason: "topic_not_supported"
    });
  });

  it("falla si no hay cliente admin configurado", async () => {
    createSupabaseAdminClientMock.mockReturnValue(null);

    const response = await POST(
      new Request("https://example.com/api/payments/mercadopago/webhook?topic=payment&data.id=123", {
        method: "POST",
        body: JSON.stringify({})
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "SUPABASE_SERVICE_ROLE_KEY es requerida para procesar webhooks de Mercado Pago."
    });
  });

  it("ignora el webhook si no viene payment id", async () => {
    const response = await POST(
      new Request("https://example.com/api/payments/mercadopago/webhook?topic=payment", {
        method: "POST",
        body: JSON.stringify({})
      })
    );

    await expect(response.json()).resolves.toEqual({
      ok: true,
      skipped: true,
      reason: "missing_payment_id"
    });
  });

  it("en desarrollo permite procesar sin secret configurado", async () => {
    vi.stubEnv("NODE_ENV", "development");
    getMercadoPagoWebhookSecretMock.mockReturnValue(null);

    const response = await POST(
      new Request("https://example.com/api/payments/mercadopago/webhook?topic=payment&data.id=123", {
        method: "POST",
        body: JSON.stringify({})
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      topic: "payment",
      dataId: "123",
      syncResult: {
        updated: true,
        organizationId: "org-1"
      }
    });
  });

  it("en produccion falla cerrado si falta el secret", async () => {
    vi.stubEnv("NODE_ENV", "production");
    getMercadoPagoWebhookSecretMock.mockReturnValue(null);

    const response = await POST(
      new Request("https://example.com/api/payments/mercadopago/webhook?topic=payment&data.id=123", {
        method: "POST",
        body: JSON.stringify({})
      })
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "MERCADOPAGO_WEBHOOK_SECRET no configurado en produccion."
    });
  });

  it("si hay secret exige headers de firma", async () => {
    getMercadoPagoWebhookSecretMock.mockReturnValue("secret");

    const response = await POST(
      new Request("https://example.com/api/payments/mercadopago/webhook?topic=payment&data.id=123", {
        method: "POST",
        body: JSON.stringify({})
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Faltan headers de firma en el webhook."
    });
  });

  it("rechaza firmas invalidas", async () => {
    getMercadoPagoWebhookSecretMock.mockReturnValue("secret");
    verifyMercadoPagoWebhookSignatureMock.mockReturnValue(false);

    const response = await POST(
      new Request("https://example.com/api/payments/mercadopago/webhook?topic=payment&data.id=123", {
        method: "POST",
        headers: {
          "x-request-id": "req-1",
          "x-signature": "ts=1,v1=bad"
        },
        body: JSON.stringify({})
      })
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Firma de webhook invalida."
    });
  });

  it("sincroniza el pago cuando la firma es valida", async () => {
    getMercadoPagoWebhookSecretMock.mockReturnValue("secret");
    verifyMercadoPagoWebhookSignatureMock.mockReturnValue(true);

    const response = await POST(
      new Request("https://example.com/api/payments/mercadopago/webhook?topic=payment&data.id=123", {
        method: "POST",
        headers: {
          "x-request-id": "req-1",
          "x-signature": "ts=1,v1=ok"
        },
        body: JSON.stringify({
          data: { id: 123 }
        })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      topic: "payment",
      dataId: "123",
      syncResult: {
        updated: true,
        organizationId: "org-1"
      }
    });
    expect(syncOrganizationBillingPaymentFromMercadoPagoMock).toHaveBeenCalledWith({
      supabase: { role: "service-role" },
      mercadopagoPaymentId: "123"
    });
  });

  it("acepta topic e id cuando llegan dentro del body", async () => {
    vi.stubEnv("NODE_ENV", "development");
    getMercadoPagoWebhookSecretMock.mockReturnValue(null);

    const response = await POST(
      new Request("https://example.com/api/payments/mercadopago/webhook", {
        method: "POST",
        body: JSON.stringify({
          type: "payment",
          data: { id: 456 }
        })
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      topic: "payment",
      dataId: "456",
      syncResult: {
        updated: true,
        organizationId: "org-1"
      }
    });
  });

  it("usa el workflow de torneos si no encuentra una orden local de grupos", async () => {
    vi.stubEnv("NODE_ENV", "development");
    getMercadoPagoWebhookSecretMock.mockReturnValue(null);
    syncOrganizationBillingPaymentFromMercadoPagoMock.mockResolvedValue({
      updated: false,
      reason: "No hay orden local asociada para este pago."
    });
    syncTournamentBillingPaymentFromMercadoPagoMock.mockResolvedValue({
      updated: true,
      createdTournamentId: "tournament-77",
      status: "approved"
    });

    const response = await POST(
      new Request("https://example.com/api/payments/mercadopago/webhook?topic=payment&data.id=777", {
        method: "POST",
        body: JSON.stringify({})
      })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      topic: "payment",
      dataId: "777",
      syncResult: {
        updated: true,
        createdTournamentId: "tournament-77",
        status: "approved"
      }
    });
    expect(syncTournamentBillingPaymentFromMercadoPagoMock).toHaveBeenCalledWith({
      supabase: { role: "service-role" },
      mercadopagoPaymentId: "777"
    });
  });

  it("devuelve 500 si explota la sincronizacion", async () => {
    vi.stubEnv("NODE_ENV", "development");
    getMercadoPagoWebhookSecretMock.mockReturnValue(null);
    syncOrganizationBillingPaymentFromMercadoPagoMock.mockRejectedValue(
      new Error("sync failed")
    );

    const response = await POST(
      new Request("https://example.com/api/payments/mercadopago/webhook?topic=payment&data.id=123", {
        method: "POST",
        body: JSON.stringify({})
      })
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "sync failed"
    });
  });
});
