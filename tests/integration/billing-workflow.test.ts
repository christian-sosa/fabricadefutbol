import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getMercadoPagoPaymentByIdMock } = vi.hoisted(() => ({
  getMercadoPagoPaymentByIdMock: vi.fn()
}));

vi.mock("@/lib/payments/mercadopago", () => ({
  getMercadoPagoPaymentById: getMercadoPagoPaymentByIdMock
}));

import { syncOrganizationBillingPaymentFromMercadoPago } from "@/lib/domain/billing-workflow";
import { createFakeSupabase } from "../helpers/fake-supabase";

const ORG_ID = "org-1";
const OTHER_ORG_ID = "org-2";
const ADMIN_ID = "admin-1";
const PAYMENT_ID = "payment-row-1";

describe("billing workflow", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-19T12:00:00.000Z"));
    getMercadoPagoPaymentByIdMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("aplica un pago aprobado y activa el periodo siguiente", async () => {
    const fake = createFakeSupabase({
      organizations: [{ id: ORG_ID, name: "Liga A", slug: "liga-a" }],
      organization_billing_payments: [
        {
          id: PAYMENT_ID,
          organization_id: ORG_ID,
          mp_external_reference: "ext-1",
          mp_payment_id: null,
          status: "pending",
          subscription_applied_at: null,
          purpose: "organization_subscription",
          requested_organization_name: null,
          requested_organization_slug: null,
          requested_by_admin_id: null,
          created_organization_id: null
        }
      ]
    });

    getMercadoPagoPaymentByIdMock.mockResolvedValue({
      id: 101,
      status: "approved",
      external_reference: "ext-1",
      date_approved: "2026-04-19T12:05:00.000Z"
    });

    const result = await syncOrganizationBillingPaymentFromMercadoPago({
      supabase: fake.client as never,
      mercadopagoPaymentId: 101
    });

    expect(result).toMatchObject({
      updated: true,
      organizationId: ORG_ID,
      localPaymentId: PAYMENT_ID,
      status: "approved"
    });

    expect(fake.table("organization_billing_subscriptions")).toEqual([
      expect.objectContaining({
        organization_id: ORG_ID,
        status: "active",
        current_period_start: "2026-04-19T12:00:00.000Z",
        current_period_end: "2026-05-19T12:00:00.000Z",
        last_payment_at: "2026-04-19T12:05:00.000Z"
      })
    ]);
    expect(fake.find("organization_billing_payments", (row) => row.id === PAYMENT_ID)).toEqual(
      expect.objectContaining({
        mp_payment_id: "101",
        status: "approved",
        subscription_applied_at: expect.any(String)
      })
    );
  });

  it("es idempotente cuando el webhook llega dos veces", async () => {
    const fake = createFakeSupabase({
      organizations: [{ id: ORG_ID, name: "Liga A", slug: "liga-a" }],
      organization_billing_payments: [
        {
          id: PAYMENT_ID,
          organization_id: ORG_ID,
          mp_external_reference: "ext-1",
          mp_payment_id: null,
          status: "pending",
          subscription_applied_at: null,
          purpose: "organization_subscription"
        }
      ]
    });

    getMercadoPagoPaymentByIdMock.mockResolvedValue({
      id: 101,
      status: "approved",
      external_reference: "ext-1",
      date_approved: "2026-04-19T12:05:00.000Z"
    });

    await syncOrganizationBillingPaymentFromMercadoPago({
      supabase: fake.client as never,
      mercadopagoPaymentId: 101
    });

    const firstSubscription = fake.table("organization_billing_subscriptions")[0];

    await syncOrganizationBillingPaymentFromMercadoPago({
      supabase: fake.client as never,
      mercadopagoPaymentId: 101
    });

    const subscriptions = fake.table("organization_billing_subscriptions");
    expect(subscriptions).toHaveLength(1);
    expect(subscriptions[0]).toEqual(firstSubscription);
  });

  it("extiende desde el fin del periodo vigente si la suscripcion actual aun no vencio", async () => {
    const fake = createFakeSupabase({
      organizations: [{ id: ORG_ID, name: "Liga A", slug: "liga-a" }],
      organization_billing_subscriptions: [
        {
          organization_id: ORG_ID,
          status: "active",
          current_period_start: "2026-03-19T12:00:00.000Z",
          current_period_end: "2026-05-19T12:00:00.000Z",
          last_payment_at: "2026-03-19T12:00:00.000Z"
        }
      ],
      organization_billing_payments: [
        {
          id: PAYMENT_ID,
          organization_id: ORG_ID,
          mp_external_reference: "ext-future",
          mp_payment_id: null,
          status: "pending",
          subscription_applied_at: null,
          purpose: "organization_subscription"
        }
      ]
    });

    getMercadoPagoPaymentByIdMock.mockResolvedValue({
      id: 111,
      status: "approved",
      external_reference: "ext-future",
      date_approved: "2026-04-19T12:10:00.000Z"
    });

    await expect(
      syncOrganizationBillingPaymentFromMercadoPago({
        supabase: fake.client as never,
        mercadopagoPaymentId: 111
      })
    ).resolves.toMatchObject({
      updated: true,
      status: "approved"
    });

    expect(fake.table("organization_billing_subscriptions")).toEqual([
      expect.objectContaining({
        organization_id: ORG_ID,
        current_period_start: "2026-05-19T12:00:00.000Z",
        current_period_end: "2026-06-19T12:00:00.000Z",
        last_payment_at: "2026-04-19T12:10:00.000Z"
      })
    ]);
  });

  it("rechaza sincronizar un pago que pertenece a otra organizacion", async () => {
    const fake = createFakeSupabase({
      organizations: [
        { id: ORG_ID, name: "Liga A", slug: "liga-a" },
        { id: OTHER_ORG_ID, name: "Liga B", slug: "liga-b" }
      ],
      organization_billing_payments: [
        {
          id: PAYMENT_ID,
          organization_id: ORG_ID,
          mp_external_reference: "ext-1",
          status: "pending",
          subscription_applied_at: null,
          purpose: "organization_subscription"
        }
      ]
    });

    getMercadoPagoPaymentByIdMock.mockResolvedValue({
      id: 101,
      status: "approved",
      external_reference: "ext-1",
      date_approved: "2026-04-19T12:05:00.000Z"
    });

    const result = await syncOrganizationBillingPaymentFromMercadoPago({
      supabase: fake.client as never,
      mercadopagoPaymentId: 101,
      expectedOrganizationId: OTHER_ORG_ID
    });

    expect(result).toEqual({
      updated: false,
      reason: "El pago no pertenece a esta organizacion."
    });
    expect(fake.table("organization_billing_subscriptions")).toHaveLength(0);
    const paymentRow = fake.find("organization_billing_payments", (row) => row.id === PAYMENT_ID);
    expect(paymentRow).toEqual(
      expect.objectContaining({
        status: "pending"
      })
    );
    expect(paymentRow).not.toHaveProperty("mp_payment_id");
  });

  it("crea una organizacion nueva cuando el pago es de alta", async () => {
    const fake = createFakeSupabase({
      admins: [{ id: ADMIN_ID, display_name: "Admin" }],
      organizations: [{ id: ORG_ID, name: "Base", slug: "base" }],
      organization_billing_payments: [
        {
          id: PAYMENT_ID,
          organization_id: ORG_ID,
          mp_external_reference: "ext-create",
          status: "pending",
          subscription_applied_at: null,
          purpose: "organization_creation",
          requested_organization_name: "Nueva Liga",
          requested_organization_slug: "nueva-liga",
          requested_by_admin_id: ADMIN_ID,
          created_organization_id: null
        }
      ]
    });

    getMercadoPagoPaymentByIdMock.mockResolvedValue({
      id: 202,
      status: "approved",
      external_reference: "ext-create",
      date_approved: "2026-04-19T12:10:00.000Z"
    });

    const result = await syncOrganizationBillingPaymentFromMercadoPago({
      supabase: fake.client as never,
      mercadopagoPaymentId: 202
    });

    expect(result.updated).toBe(true);
    expect(result.createdOrganizationId).toBeTruthy();

    const createdOrganizationId = String(result.createdOrganizationId);
    expect(fake.find("organizations", (row) => row.id === createdOrganizationId)).toEqual(
      expect.objectContaining({
        name: "Nueva Liga",
        slug: "nueva-liga"
      })
    );
    expect(
      fake.find(
        "organization_admins",
        (row) => row.organization_id === createdOrganizationId && row.admin_id === ADMIN_ID
      )
    ).toBeTruthy();
    expect(
      fake.find(
        "organization_billing_subscriptions",
        (row) => row.organization_id === createdOrganizationId
      )
    ).toEqual(
      expect.objectContaining({
        status: "active"
      })
    );
  });

  it("usa la hora actual si Mercado Pago no informa date_approved", async () => {
    const fake = createFakeSupabase({
      organizations: [{ id: ORG_ID, name: "Liga A", slug: "liga-a" }],
      organization_billing_payments: [
        {
          id: PAYMENT_ID,
          organization_id: ORG_ID,
          mp_external_reference: "ext-no-approved-at",
          mp_payment_id: null,
          status: "pending",
          subscription_applied_at: null,
          purpose: "organization_subscription"
        }
      ]
    });

    getMercadoPagoPaymentByIdMock.mockResolvedValue({
      id: 505,
      status: "approved",
      external_reference: "ext-no-approved-at",
      date_approved: null
    });

    await expect(
      syncOrganizationBillingPaymentFromMercadoPago({
        supabase: fake.client as never,
        mercadopagoPaymentId: 505
      })
    ).resolves.toMatchObject({
      updated: true,
      status: "approved"
    });

    expect(fake.table("organization_billing_subscriptions")).toEqual([
      expect.objectContaining({
        organization_id: ORG_ID,
        last_payment_at: "2026-04-19T12:00:00.000Z"
      })
    ]);
  });

  it("si el alta aprobada no puede crear organizacion deja el pago sincronizado sin suscripcion nueva", async () => {
    const fake = createFakeSupabase({
      admins: [{ id: ADMIN_ID, display_name: "Admin" }],
      organizations: [{ id: ORG_ID, name: "Base", slug: "base" }],
      organization_billing_payments: [
        {
          id: PAYMENT_ID,
          organization_id: ORG_ID,
          mp_external_reference: "ext-create-missing-data",
          status: "pending",
          subscription_applied_at: null,
          purpose: "organization_creation",
          requested_organization_name: null,
          requested_organization_slug: null,
          requested_by_admin_id: ADMIN_ID,
          created_organization_id: null
        }
      ]
    });

    getMercadoPagoPaymentByIdMock.mockResolvedValue({
      id: 606,
      status: "approved",
      external_reference: "ext-create-missing-data",
      date_approved: "2026-04-19T12:10:00.000Z"
    });

    await expect(
      syncOrganizationBillingPaymentFromMercadoPago({
        supabase: fake.client as never,
        mercadopagoPaymentId: 606
      })
    ).resolves.toEqual({
      updated: true,
      organizationId: ORG_ID,
      localPaymentId: PAYMENT_ID,
      status: "approved",
      createdOrganizationId: null
    });

    expect(fake.table("organizations")).toHaveLength(1);
    expect(fake.table("organization_billing_subscriptions")).toHaveLength(0);
    expect(fake.find("organization_billing_payments", (row) => row.id === PAYMENT_ID)).toEqual(
      expect.objectContaining({
        mp_payment_id: "606",
        status: "approved",
        subscription_applied_at: null
      })
    );
  });

  it("devuelve un skip amable si Mercado Pago responde 404", async () => {
    const fake = createFakeSupabase();
    getMercadoPagoPaymentByIdMock.mockRejectedValue(
      new Error("Mercado Pago API error (404): not found")
    );

    await expect(
      syncOrganizationBillingPaymentFromMercadoPago({
        supabase: fake.client as never,
        mercadopagoPaymentId: 404
      })
    ).resolves.toEqual({
      updated: false,
      reason: "Pago no encontrado en Mercado Pago. Puede ser un webhook de prueba."
    });
  });

  it("devuelve updated false si no existe la orden local", async () => {
    const fake = createFakeSupabase();
    getMercadoPagoPaymentByIdMock.mockResolvedValue({
      id: 303,
      status: "approved",
      external_reference: "missing-order",
      date_approved: "2026-04-19T12:00:00.000Z"
    });

    await expect(
      syncOrganizationBillingPaymentFromMercadoPago({
        supabase: fake.client as never,
        mercadopagoPaymentId: 303
      })
    ).resolves.toEqual({
      updated: false,
      reason: "No hay orden local asociada para este pago."
    });
  });

  it("actualiza el pago rechazado sin activar una suscripcion", async () => {
    const fake = createFakeSupabase({
      organizations: [{ id: ORG_ID, name: "Liga A", slug: "liga-a" }],
      organization_billing_payments: [
        {
          id: PAYMENT_ID,
          organization_id: ORG_ID,
          mp_external_reference: "ext-rejected",
          status: "pending",
          subscription_applied_at: null,
          purpose: "organization_subscription"
        }
      ]
    });

    getMercadoPagoPaymentByIdMock.mockResolvedValue({
      id: 909,
      status: "rejected",
      external_reference: "ext-rejected",
      date_approved: null
    });

    await expect(
      syncOrganizationBillingPaymentFromMercadoPago({
        supabase: fake.client as never,
        mercadopagoPaymentId: 909
      })
    ).resolves.toMatchObject({
      updated: true,
      status: "rejected"
    });

    expect(fake.table("organization_billing_subscriptions")).toHaveLength(0);
    expect(fake.find("organization_billing_payments", (row) => row.id === PAYMENT_ID)).toEqual(
      expect.objectContaining({
        mp_payment_id: "909",
        status: "rejected"
      })
    );
  });
});
