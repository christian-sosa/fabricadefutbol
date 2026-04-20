import crypto from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createCheckoutProPreference,
  getMercadoPagoPaymentById,
  parseMercadoPagoSignatureHeader,
  verifyMercadoPagoWebhookSignature
} from "@/lib/payments/mercadopago";

describe("mercadopago helpers", () => {
  beforeEach(() => {
    vi.stubEnv("MERCADOPAGO_ACCESS_TOKEN", "TEST-token");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("parsea el header de firma", () => {
    expect(parseMercadoPagoSignatureHeader("ts=1713500000000, v1=abc123")).toEqual({
      ts: "1713500000000",
      v1: "abc123"
    });
    expect(parseMercadoPagoSignatureHeader("v1=missing-ts")).toBeNull();
  });

  it("valida una firma correcta y rechaza una vencida", () => {
    const secret = "super-secret";
    const ts = "1713500000000";
    const requestId = "request-123";
    const dataId = "PAY-42";
    const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
    const v1 = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

    expect(
      verifyMercadoPagoWebhookSignature({
        secret,
        dataId,
        requestId,
        signatureHeader: `ts=${ts},v1=${v1}`,
        now: 1713500000000
      })
    ).toBe(true);

    expect(
      verifyMercadoPagoWebhookSignature({
        secret,
        dataId,
        requestId,
        signatureHeader: `ts=${ts},v1=${v1}`,
        now: 1713500000000 + 11 * 60 * 1000
      })
    ).toBe(false);
  });

  it("reintenta lecturas cuando Mercado Pago responde 429", async () => {
    vi.useFakeTimers();

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: 123, status: "approved" }), {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const request = getMercadoPagoPaymentById(123);
    await vi.runAllTimersAsync();

    await expect(request).resolves.toEqual({
      id: 123,
      status: "approved"
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("crea una preferencia con POST e idempotency key", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "pref-1",
          init_point: "https://mp.test/init",
          sandbox_init_point: "https://mp.test/sandbox"
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json"
          }
        }
      )
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await createCheckoutProPreference({
      title: "Plan mensual",
      unitPrice: 5000,
      currencyId: "ARS",
      expiresAt: "2026-04-20T12:00:00.000Z",
      externalReference: "ext-1",
      notificationUrl: "https://example.com/webhook",
      successUrl: "https://example.com/success",
      failureUrl: "https://example.com/failure",
      pendingUrl: "https://example.com/pending"
    });

    expect(result).toEqual({
      id: "pref-1",
      init_point: "https://mp.test/init",
      sandbox_init_point: "https://mp.test/sandbox"
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/checkout/preferences"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer TEST-token",
          "X-Idempotency-Key": expect.any(String)
        })
      })
    );

    const requestInit = fetchMock.mock.calls[0]?.[1];
    expect(requestInit).toBeTruthy();
    const requestBody = JSON.parse(String(requestInit?.body ?? "{}"));
    expect(requestBody).toMatchObject({
      expires: true,
      expiration_date_to: "2026-04-20T12:00:00.000Z"
    });
    expect(requestBody.expiration_date_from).toEqual(expect.any(String));
  });

  it("corta luego de agotar reintentos por 500", async () => {
    vi.useFakeTimers();

    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("server error", { status: 500 }));

    vi.stubGlobal("fetch", fetchMock);

    const request = getMercadoPagoPaymentById(999);
    const assertion = expect(request).rejects.toThrow("Mercado Pago API error (500)");
    await vi.runAllTimersAsync();

    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("rechaza headers de firma mal formados", () => {
    expect(
      verifyMercadoPagoWebhookSignature({
        secret: "secret",
        dataId: "123",
        requestId: "req-1",
        signatureHeader: "broken-header",
        now: Date.now()
      })
    ).toBe(false);
  });
});
