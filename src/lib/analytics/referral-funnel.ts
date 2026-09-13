type Event = { event_name: string; source: string; entity_id: string | null; properties: unknown };

export function calculateReferralFunnel(events: Event[]) {
  const visits = new Set<string>();
  const signups = new Set<string>();
  const groups = new Set<string>();
  for (const event of events) {
    const props = event.properties && typeof event.properties === "object" ? event.properties as Record<string, unknown> : {};
    if (event.event_name === "referral_visit" && props.referral_source === "whatsapp" && typeof props.session_id === "string") visits.add(props.session_id);
  }
  for (const event of events) {
    if (event.source === "client" || !event.entity_id) continue;
    const props = event.properties && typeof event.properties === "object" ? event.properties as Record<string, unknown> : {};
    if (typeof props.referral_session_id !== "string" || !visits.has(props.referral_session_id)) continue;
    if (event.event_name === "admin_register_succeeded") signups.add(event.entity_id);
    if (event.event_name === "group_created") groups.add(event.entity_id);
  }
  return { referredSessions: visits.size, referredRegistrations: signups.size, referredGroups: groups.size };
}
