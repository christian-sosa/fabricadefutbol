import { describe, expect, it } from "vitest";

import {
  SERVER_ANALYTICS_EVENTS,
  isClientAnalyticsEventName,
  isAnalyticsEventName,
  sanitizeAnalyticsPath,
  sanitizeAnalyticsProperties
} from "@/lib/analytics/events";
import { buildAnalyticsEventInsert, insertAnalyticsEvent } from "@/lib/analytics/server";
import { GROWTH_EVENTS } from "@/lib/growth";

import { createFakeSupabase } from "../helpers/fake-supabase";

describe("analytics events", () => {
  it("solo acepta eventos de la allowlist", () => {
    expect(isAnalyticsEventName(GROWTH_EVENTS.ctaClicked)).toBe(true);
    expect(isAnalyticsEventName(SERVER_ANALYTICS_EVENTS.adminLoginSucceeded)).toBe(true);
    expect(isAnalyticsEventName("raw_email_exported")).toBe(false);
    expect(buildAnalyticsEventInsert({ eventName: "unknown_event" })).toBeNull();
  });

  it("sanitiza propiedades para no guardar PII cruda", () => {
    expect(
      sanitizeAnalyticsProperties({
        cta: "home",
        email: "persona@example.com",
        nested: { owner: "persona@example.com" },
        phone: "11111111",
        count: 2
      })
    ).toEqual({
      cta: "home",
      nested: '{"owner":"[redacted]"}',
      count: 2
    });
  });

  it("reserva altas, resultados y autenticación para el servidor", () => {
    for (const event of ["group_created", "match_created", "match_finished", "admin_register_succeeded", "admin_login_succeeded", "payment_approved"]) expect(isClientAnalyticsEventName(event)).toBe(false);
    expect(isClientAnalyticsEventName("referral_visit")).toBe(true);
  });

  it("elimina secretos anidados y parámetros de URLs", () => {
    const properties = sanitizeAnalyticsProperties({ details: { password: "secret-value", items: [{ token: "secret-token", count: 2 }] }, link: "https://fdf.example/invite/private-token?email=a@example.com" });
    expect(JSON.stringify(properties)).not.toContain("secret-value");
    expect(JSON.stringify(properties)).not.toContain("secret-token");
    expect(properties.details).toBe('{"items":[{"count":2}]}');
    expect(sanitizeAnalyticsPath("/invite/private-token?email=a@example.com")).toBe("/invite/:token");
    expect(sanitizeAnalyticsPath("/admin?org=private&token=secret")).toBe("/admin");
  });

  it("usa una clave estable por hecho de negocio y absorbe reintentos", async () => {
    const input = { eventName: "match_finished", entityId: "00000000-0000-4000-8000-000000000001" };
    expect(buildAnalyticsEventInsert(input)?.event_key).toBe(`match_finished:${input.entityId}`);
    const db = { from: () => ({ insert: () => ({ select: () => ({ single: async () => ({ data: null, error: { code: "23505", message: "duplicate" } }) }) }) }) };
    await expect(insertAnalyticsEvent(db, input)).resolves.toMatchObject({ recorded: false, reason: "duplicate" });
  });

  it("inserta eventos permitidos con propiedades sanitizadas", async () => {
    const fake = createFakeSupabase();

    await insertAnalyticsEvent(fake.client, {
      eventName: SERVER_ANALYTICS_EVENTS.adminLoginSucceeded,
      source: "auth_password",
      adminId: "00000000-0000-4000-8000-000000000001",
      entityType: "admin",
      entityId: "00000000-0000-4000-8000-000000000001",
      path: "/admin",
      properties: {
        email: "persona@example.com",
        source: "login_form"
      }
    });

    expect(fake.table("analytics_events")).toMatchObject([
      {
        event_name: "admin_login_succeeded",
        source: "auth_password",
        admin_id: "00000000-0000-4000-8000-000000000001",
        entity_type: "admin",
        entity_id: "00000000-0000-4000-8000-000000000001",
        path: "/admin",
        properties: {
          source: "login_form"
        }
      }
    ]);
  });
});
