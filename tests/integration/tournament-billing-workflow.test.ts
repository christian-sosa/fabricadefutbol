import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getMercadoPagoPaymentByIdMock } = vi.hoisted(() => ({
  getMercadoPagoPaymentByIdMock: vi.fn()
}));

vi.mock("@/lib/payments/mercadopago", () => ({
  getMercadoPagoPaymentById: getMercadoPagoPaymentByIdMock
}));

import { syncTournamentBillingPaymentFromMercadoPago } from "@/lib/domain/tournament-billing-workflow";
import { createFakeSupabase } from "../helpers/fake-supabase";

const ADMIN_ID = "admin-1";
const PAYMENT_ID = "tournament-payment-1";

describe("tournament billing workflow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-24T12:00:00.000Z"));
    getMercadoPagoPaymentByIdMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("crea el torneo cuando el pago queda aprobado", async () => {
    const fake = createFakeSupabase({
      admins: [{ id: ADMIN_ID, display_name: "Admin torneo" }],
      tournament_billing_payments: [
        {
          id: PAYMENT_ID,
          admin_id: ADMIN_ID,
          requested_tournament_name: "Viernes A1",
          requested_tournament_slug: "viernes-a1",
          mp_external_reference: "ext-tournament-1",
          mp_payment_id: null,
          status: "pending",
          created_tournament_id: null
        }
      ]
    });

    getMercadoPagoPaymentByIdMock.mockResolvedValue({
      id: 101,
      status: "approved",
      external_reference: "ext-tournament-1",
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
    expect(result.createdTournamentId).toBeTruthy();

    const createdTournamentId = String(result.createdTournamentId);
    expect(fake.find("tournaments", (row) => row.id === createdTournamentId)).toEqual(
      expect.objectContaining({
        name: "Viernes A1",
        slug: "viernes-a1",
        status: "draft",
        is_public: true,
        created_by: ADMIN_ID
      })
    );
    expect(
      fake.find(
        "tournament_admins",
        (row) => row.tournament_id === createdTournamentId && row.admin_id === ADMIN_ID
      )
    ).toBeTruthy();
    expect(
      fake.find("tournament_billing_payments", (row) => row.id === PAYMENT_ID)
    ).toEqual(
      expect.objectContaining({
        mp_payment_id: "101",
        status: "approved",
        created_tournament_id: createdTournamentId
      })
    );
  });

  it("es idempotente cuando Mercado Pago informa el mismo pago mas de una vez", async () => {
    const fake = createFakeSupabase({
      admins: [{ id: ADMIN_ID, display_name: "Admin torneo" }],
      tournament_billing_payments: [
        {
          id: PAYMENT_ID,
          admin_id: ADMIN_ID,
          requested_tournament_name: "Viernes A2",
          requested_tournament_slug: "viernes-a2",
          mp_external_reference: "ext-tournament-2",
          mp_payment_id: null,
          status: "pending",
          created_tournament_id: null
        }
      ]
    });

    getMercadoPagoPaymentByIdMock.mockResolvedValue({
      id: 202,
      status: "approved",
      external_reference: "ext-tournament-2",
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

    expect(secondResult.createdTournamentId).toBe(firstResult.createdTournamentId);
    expect(fake.table("tournaments")).toHaveLength(1);
  });
});
