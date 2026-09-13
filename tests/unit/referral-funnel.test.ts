import { describe, expect, it } from "vitest";
import { calculateReferralFunnel } from "@/lib/analytics/referral-funnel";
describe("atribución de referencias", () => {
  it("deduplica visitas y hechos, y excluye falsos hechos antiguos del cliente", () => {
    const visit = { event_name: "referral_visit", source: "client", entity_id: null, properties: { session_id: "visit", referral_source: "whatsapp" } };
    const group = { event_name: "group_created", source: "server_action", entity_id: "group", properties: { referral_session_id: "visit" } };
    expect(calculateReferralFunnel([visit, visit, group, group, { ...group, source: "client", entity_id: "fake" }, { ...group, entity_id: "other", properties: { referral_session_id: "unknown" } }])).toEqual({ referredSessions: 1, referredRegistrations: 0, referredGroups: 1 });
  });
});
