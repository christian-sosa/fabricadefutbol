import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getMercadoPagoPaymentByIdMock } = vi.hoisted(() => ({
  getMercadoPagoPaymentByIdMock: vi.fn()
}));

vi.mock("@/lib/payments/mercadopago", () => ({
  getMercadoPagoPaymentById: getMercadoPagoPaymentByIdMock
}));

import {
  approveTournamentBillingPaymentForDebug,
  syncTournamentBillingPaymentFromMercadoPago
} from "@/lib/domain/tournament-billing-workflow";
import { createFakeSupabase } from "../helpers/fake-supabase";

const ADMIN_ID = "admin-1";
const PAYMENT_ID = "league-payment-1";

function leaguePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: PAYMENT_ID,
    admin_id: ADMIN_ID,
    requested_league_name: "LAFAB",
    requested_league_slug: "lafab",
    mp_external_reference: "ext-league",
    mp_payment_id: null,
    status: "pending",
    created_league_id: null,
    ...overrides
  };
}

describe("league billing workflow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-24T12:00:00.000Z"));
    getMercadoPagoPaymentByIdMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("crea la liga cuando el pago queda aprobado", async () => {
    const fake = createFakeSupabase({
      admins: [{ id: ADMIN_ID, display_name: "Admin liga" }],
      league_billing_payments: [
        {
          id: PAYMENT_ID,
          admin_id: ADMIN_ID,
          requested_league_name: "LAFAB",
          requested_league_slug: "lafab",
          mp_external_reference: "ext-league-1",
          mp_payment_id: null,
          status: "pending",
          created_league_id: null
        }
      ]
    });

    getMercadoPagoPaymentByIdMock.mockResolvedValue({
      id: 101,
      status: "approved",
      external_reference: "ext-league-1",
      date_approved: "2026-04-24T12:05:00.000Z"
    });

    const result = await syncTournamentBillingPaymentFromMercadoPago({
      supabase: fake.client as never,
      mercadopagoPaymentId: 101
    });

    expect(result).toMatchObject({
      updated: true,
      localPaymentId: PAYMENT_ID,
      status: "approved"
    });
    expect(result.createdLeagueId).toBeTruthy();

    const createdLeagueId = String(result.createdLeagueId);
    expect(fake.find("leagues", (row) => row.id === createdLeagueId)).toEqual(
      expect.objectContaining({
        name: "LAFAB",
        slug: "lafab",
        status: "draft",
        is_public: true,
        created_by: ADMIN_ID
      })
    );
    expect(
      fake.find("league_admins", (row) => row.league_id === createdLeagueId && row.admin_id === ADMIN_ID)
    ).toBeTruthy();
    expect(fake.find("league_billing_payments", (row) => row.id === PAYMENT_ID)).toEqual(
      expect.objectContaining({
        mp_payment_id: "101",
        status: "approved",
        created_league_id: createdLeagueId
      })
    );
    expect(fake.find("league_billing_subscriptions", (row) => row.league_id === createdLeagueId)).toEqual(
      expect.objectContaining({
        status: "active",
        current_period_start: "2026-04-24T12:00:00.000Z",
        current_period_end: "2026-05-24T12:00:00.000Z",
        last_payment_at: "2026-04-24T12:05:00.000Z"
      })
    );
  });

  it("es idempotente cuando Mercado Pago informa el mismo pago mas de una vez", async () => {
    const fake = createFakeSupabase({
      admins: [{ id: ADMIN_ID, display_name: "Admin liga" }],
      league_billing_payments: [
        {
          id: PAYMENT_ID,
          admin_id: ADMIN_ID,
          requested_league_name: "LAFAB Clausura",
          requested_league_slug: "lafab-clausura",
          mp_external_reference: "ext-league-2",
          mp_payment_id: null,
          status: "pending",
          created_league_id: null
        }
      ]
    });

    getMercadoPagoPaymentByIdMock.mockResolvedValue({
      id: 202,
      status: "approved",
      external_reference: "ext-league-2",
      date_approved: "2026-04-24T12:08:00.000Z"
    });

    const firstResult = await syncTournamentBillingPaymentFromMercadoPago({
      supabase: fake.client as never,
      mercadopagoPaymentId: 202
    });
    const secondResult = await syncTournamentBillingPaymentFromMercadoPago({
      supabase: fake.client as never,
      mercadopagoPaymentId: 202
    });

    expect(secondResult.createdLeagueId).toBe(firstResult.createdLeagueId);
    expect(fake.table("leagues")).toHaveLength(1);
  });

  it("puede saltear Mercado Pago y aprobar localmente para debug", async () => {
    const fake = createFakeSupabase({
      admins: [{ id: ADMIN_ID, display_name: "Admin liga" }],
      league_billing_payments: [
        {
          id: PAYMENT_ID,
          admin_id: ADMIN_ID,
          requested_league_name: "Liga Debug",
          requested_league_slug: "liga-debug",
          mp_external_reference: "ext-league-debug",
          mp_payment_id: null,
          status: "pending",
          created_league_id: null
        }
      ]
    });

    const result = await approveTournamentBillingPaymentForDebug({
      supabase: fake.client as never,
      localPaymentId: PAYMENT_ID
    });

    expect(result).toMatchObject({
      updated: true,
      localPaymentId: PAYMENT_ID,
      status: "approved",
      skippedCheckout: true
    });
    expect(result.createdLeagueId).toBeTruthy();

    const createdLeagueId = String(result.createdLeagueId);
    expect(fake.find("league_billing_payments", (row) => row.id === PAYMENT_ID)).toEqual(
      expect.objectContaining({
        mp_payment_id: `debug-skip-${PAYMENT_ID}`,
        status: "approved",
        created_league_id: createdLeagueId
      })
    );
    expect(fake.table("leagues")).toHaveLength(1);
  });

  it("extiende un mes mas cuando se aprueba una renovacion mensual", async () => {
    const fake = createFakeSupabase({
      admins: [{ id: ADMIN_ID, display_name: "Admin liga" }],
      leagues: [{ id: "league-1", name: "LAFAB", slug: "lafab", created_by: ADMIN_ID }],
      league_billing_subscriptions: [
        {
          league_id: "league-1",
          status: "active",
          current_period_start: "2026-04-01T00:00:00.000Z",
          current_period_end: "2026-05-01T00:00:00.000Z",
          last_payment_at: "2026-04-01T00:00:00.000Z"
        }
      ],
      league_billing_payments: [
        {
          id: PAYMENT_ID,
          admin_id: ADMIN_ID,
          requested_league_name: "LAFAB",
          requested_league_slug: "lafab",
          created_league_id: "league-1",
          purpose: "league_subscription",
          mp_external_reference: "ext-league-renewal",
          mp_payment_id: null,
          status: "pending"
        }
      ]
    });

    getMercadoPagoPaymentByIdMock.mockResolvedValue({
      id: 303,
      status: "approved",
      external_reference: "ext-league-renewal",
      date_approved: "2026-04-24T13:00:00.000Z"
    });

    const result = await syncTournamentBillingPaymentFromMercadoPago({
      supabase: fake.client as never,
      mercadopagoPaymentId: 303
    });

    expect(result).toMatchObject({
      updated: true,
      localPaymentId: PAYMENT_ID,
      status: "approved",
      createdLeagueId: "league-1"
    });
    expect(fake.find("league_billing_subscriptions", (row) => row.league_id === "league-1")).toEqual(
      expect.objectContaining({
        status: "active",
        current_period_start: "2026-05-01T00:00:00.000Z",
        current_period_end: "2026-06-01T00:00:00.000Z",
        last_payment_at: "2026-04-24T13:00:00.000Z"
      })
    );
    expect(fake.find("league_billing_payments", (row) => row.id === PAYMENT_ID)).toEqual(
      expect.objectContaining({
        purpose: "league_subscription",
        period_start: "2026-05-01T00:00:00.000Z",
        period_end: "2026-06-01T00:00:00.000Z"
      })
    );
  });

  it("rechaza sincronizar un payment id asociado a otra liga", async () => {
    const fake = createFakeSupabase({
      admins: [{ id: ADMIN_ID, display_name: "Admin liga" }],
      leagues: [
        { id: "league-1", name: "Liga Uno", slug: "liga-uno", created_by: ADMIN_ID },
        { id: "league-2", name: "Liga Dos", slug: "liga-dos", created_by: ADMIN_ID }
      ],
      league_billing_payments: [
        {
          id: PAYMENT_ID,
          admin_id: ADMIN_ID,
          requested_league_name: "Liga Dos",
          requested_league_slug: "liga-dos",
          created_league_id: "league-2",
          purpose: "league_subscription",
          mp_external_reference: "ext-league-cross-tenant",
          mp_payment_id: null,
          status: "pending"
        }
      ]
    });

    getMercadoPagoPaymentByIdMock.mockResolvedValue({
      id: 404,
      status: "approved",
      external_reference: "ext-league-cross-tenant",
      date_approved: "2026-04-24T14:00:00.000Z"
    });

    const result = await syncTournamentBillingPaymentFromMercadoPago({
      supabase: fake.client as never,
      mercadopagoPaymentId: 404,
      expectedLeagueId: "league-1"
    });

    expect(result).toEqual({
      updated: false,
      reason: "El pago no pertenece a esta liga."
    });
    expect(fake.find("league_billing_payments", (row) => row.id === PAYMENT_ID)).toEqual(
      expect.objectContaining({
        mp_payment_id: null,
        status: "pending",
        created_league_id: "league-2",
        subscription_applied_at: null
      })
    );
    expect(fake.table("league_billing_subscriptions")).toHaveLength(0);
  });

  it("ignora webhooks de prueba cuando Mercado Pago responde 404", async () => {
    const fake = createFakeSupabase();
    getMercadoPagoPaymentByIdMock.mockRejectedValue(new Error("Mercado Pago API error (404): not found"));

    const result = await syncTournamentBillingPaymentFromMercadoPago({
      supabase: fake.client as never,
      mercadopagoPaymentId: 505
    });

    expect(result).toEqual({
      updated: false,
      reason: "Pago no encontrado en Mercado Pago. Puede ser un webhook de prueba."
    });
    expect(fake.table("league_billing_payments")).toHaveLength(0);
  });

  it("ignora pagos aprobados que no tienen orden local asociada", async () => {
    const fake = createFakeSupabase();
    getMercadoPagoPaymentByIdMock.mockResolvedValue({
      id: 606,
      status: "approved",
      external_reference: null,
      date_approved: "2026-04-24T15:00:00.000Z"
    });

    const result = await syncTournamentBillingPaymentFromMercadoPago({
      supabase: fake.client as never,
      mercadopagoPaymentId: 606
    });

    expect(result).toEqual({
      updated: false,
      reason: "No hay orden local asociada para este pago."
    });
    expect(fake.table("leagues")).toHaveLength(0);
  });

  it("actualiza la orden sin crear liga si el pago no esta aprobado", async () => {
    const fake = createFakeSupabase({
      league_billing_payments: [
        leaguePayment({
          mp_external_reference: "ext-rejected"
        })
      ]
    });
    getMercadoPagoPaymentByIdMock.mockResolvedValue({
      id: 707,
      status: "rejected",
      external_reference: "ext-rejected",
      date_approved: null
    });

    const result = await syncTournamentBillingPaymentFromMercadoPago({
      supabase: fake.client as never,
      mercadopagoPaymentId: 707
    });

    expect(result).toEqual({
      updated: true,
      localPaymentId: PAYMENT_ID,
      status: "rejected",
      createdLeagueId: null,
      createdTournamentId: null
    });
    expect(fake.find("league_billing_payments", (row) => row.id === PAYMENT_ID)).toEqual(
      expect.objectContaining({
        mp_payment_id: "707",
        status: "rejected",
        created_league_id: null,
        subscription_applied_at: null
      })
    );
    expect(fake.table("leagues")).toHaveLength(0);
    expect(fake.table("league_billing_subscriptions")).toHaveLength(0);
  });

  it("encuentra una orden por mp_payment_id aunque no venga external_reference", async () => {
    const fake = createFakeSupabase({
      leagues: [{ id: "league-1", name: "Liga MP", slug: "liga-mp", created_by: ADMIN_ID }],
      league_billing_payments: [
        leaguePayment({
          created_league_id: "league-1",
          mp_payment_id: "808",
          mp_external_reference: "ext-original",
          purpose: "league_subscription"
        })
      ]
    });
    getMercadoPagoPaymentByIdMock.mockResolvedValue({
      id: 808,
      status: "approved",
      external_reference: null,
      date_approved: "2026-04-24T16:00:00.000Z"
    });

    const result = await syncTournamentBillingPaymentFromMercadoPago({
      supabase: fake.client as never,
      mercadopagoPaymentId: 808
    });

    expect(result).toMatchObject({
      updated: true,
      localPaymentId: PAYMENT_ID,
      status: "approved",
      createdLeagueId: "league-1"
    });
    expect(fake.find("league_billing_subscriptions", (row) => row.league_id === "league-1")).toEqual(
      expect.objectContaining({
        status: "active",
        last_payment_at: "2026-04-24T16:00:00.000Z"
      })
    );
  });

  it("reusa una liga existente si pertenece al admin que pago", async () => {
    const fake = createFakeSupabase({
      leagues: [{ id: "league-existing", name: "Liga Existente", slug: "liga-existente", created_by: ADMIN_ID }],
      league_billing_payments: [
        leaguePayment({
          requested_league_name: "Liga Existente",
          requested_league_slug: "liga-existente",
          mp_external_reference: "ext-existing"
        })
      ]
    });
    getMercadoPagoPaymentByIdMock.mockResolvedValue({
      id: 909,
      status: "approved",
      external_reference: "ext-existing",
      date_approved: "2026-04-24T17:00:00.000Z"
    });

    const result = await syncTournamentBillingPaymentFromMercadoPago({
      supabase: fake.client as never,
      mercadopagoPaymentId: 909
    });

    expect(result.createdLeagueId).toBe("league-existing");
    expect(fake.table("leagues")).toHaveLength(1);
    expect(fake.find("league_billing_payments", (row) => row.id === PAYMENT_ID)).toEqual(
      expect.objectContaining({
        created_league_id: "league-existing",
        status: "approved"
      })
    );
  });

  it("rechaza crear una liga con nombre ocupado por otro admin", async () => {
    const fake = createFakeSupabase({
      leagues: [{ id: "league-other", name: "Liga Reservada", slug: "liga-reservada", created_by: "admin-2" }],
      league_billing_payments: [
        leaguePayment({
          requested_league_name: "Liga Reservada",
          requested_league_slug: "liga-reservada",
          mp_external_reference: "ext-reserved"
        })
      ]
    });
    getMercadoPagoPaymentByIdMock.mockResolvedValue({
      id: 1001,
      status: "approved",
      external_reference: "ext-reserved",
      date_approved: "2026-04-24T18:00:00.000Z"
    });

    await expect(
      syncTournamentBillingPaymentFromMercadoPago({
        supabase: fake.client as never,
        mercadopagoPaymentId: 1001
      })
    ).rejects.toThrow("Ya existe una liga con ese nombre.");
  });

  it("agrega sufijo al slug si el slug pedido ya existe", async () => {
    const fake = createFakeSupabase({
      leagues: [
        { id: "league-a", name: "Super Liga A", slug: "super-liga", created_by: ADMIN_ID },
        { id: "league-b", name: "Super Liga B", slug: "super-liga-2", created_by: ADMIN_ID }
      ],
      league_billing_payments: [
        leaguePayment({
          requested_league_name: "Super Liga Nueva",
          requested_league_slug: "super-liga",
          mp_external_reference: "ext-slug"
        })
      ]
    });
    getMercadoPagoPaymentByIdMock.mockResolvedValue({
      id: 1002,
      status: "approved",
      external_reference: "ext-slug",
      date_approved: "2026-04-24T19:00:00.000Z"
    });

    const result = await syncTournamentBillingPaymentFromMercadoPago({
      supabase: fake.client as never,
      mercadopagoPaymentId: 1002
    });

    expect(fake.find("leagues", (row) => row.id === result.createdLeagueId)).toEqual(
      expect.objectContaining({
        name: "Super Liga Nueva",
        slug: "super-liga-3"
      })
    );
  });

  it("debug devuelve falso si no encuentra la orden local", async () => {
    const fake = createFakeSupabase();

    const result = await approveTournamentBillingPaymentForDebug({
      supabase: fake.client as never,
      localPaymentId: "missing-payment"
    });

    expect(result).toEqual({
      updated: false,
      reason: "No hay orden local asociada para este pago."
    });
  });

  it("debug puede aprobar una renovacion existente sin crear otra liga", async () => {
    const fake = createFakeSupabase({
      leagues: [{ id: "league-1", name: "Liga Debug", slug: "liga-debug", created_by: ADMIN_ID }],
      league_billing_payments: [
        leaguePayment({
          created_league_id: "league-1",
          mp_payment_id: "manual-debug-payment",
          purpose: "league_subscription"
        })
      ]
    });

    const result = await approveTournamentBillingPaymentForDebug({
      supabase: fake.client as never,
      localPaymentId: PAYMENT_ID
    });

    expect(result).toMatchObject({
      updated: true,
      createdLeagueId: "league-1",
      skippedCheckout: true
    });
    expect(fake.table("leagues")).toHaveLength(1);
    expect(fake.find("league_billing_payments", (row) => row.id === PAYMENT_ID)).toEqual(
      expect.objectContaining({
        mp_payment_id: "manual-debug-payment",
        status: "approved",
        created_league_id: "league-1"
      })
    );
  });

  it("no vuelve a aplicar la suscripcion si la orden ya fue aplicada", async () => {
    const fake = createFakeSupabase({
      leagues: [{ id: "league-1", name: "Liga Aplicada", slug: "liga-aplicada", created_by: ADMIN_ID }],
      league_billing_subscriptions: [
        {
          league_id: "league-1",
          status: "active",
          current_period_start: "2026-04-01T00:00:00.000Z",
          current_period_end: "2026-05-01T00:00:00.000Z",
          last_payment_at: "2026-04-01T00:00:00.000Z"
        }
      ],
      league_billing_payments: [
        leaguePayment({
          created_league_id: "league-1",
          purpose: "league_subscription",
          mp_external_reference: "ext-already-applied",
          subscription_applied_at: "2026-04-01T00:00:00.000Z"
        })
      ]
    });
    getMercadoPagoPaymentByIdMock.mockResolvedValue({
      id: 1003,
      status: "approved",
      external_reference: "ext-already-applied",
      date_approved: "2026-04-24T20:00:00.000Z"
    });

    await syncTournamentBillingPaymentFromMercadoPago({
      supabase: fake.client as never,
      mercadopagoPaymentId: 1003
    });

    expect(fake.find("league_billing_subscriptions", (row) => row.league_id === "league-1")).toEqual(
      expect.objectContaining({
        current_period_start: "2026-04-01T00:00:00.000Z",
        current_period_end: "2026-05-01T00:00:00.000Z",
        last_payment_at: "2026-04-01T00:00:00.000Z"
      })
    );
  });
});
