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
});
