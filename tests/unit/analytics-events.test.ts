import { describe, expect, it } from "vitest";

import {
  SERVER_ANALYTICS_EVENTS,
  isAnalyticsEventName,
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
      nested: "[redacted]",
      count: 2
    });
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
