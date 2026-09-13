import { cookies } from "next/headers";
import { z } from "zod";
export const ANALYTICS_SESSION_COOKIE = "fdf_analytics_session";
export const ANALYTICS_REFERRAL_COOKIE = "fdf_analytics_referral";
export const referralSchema = z.object({ sessionId: z.string().uuid(), source: z.literal("whatsapp"), content: z.enum(["group", "ranking", "match", "other"]) });
export async function getAnalyticsAttribution() {
  try {
    const jar = await cookies();
    const session = z.string().uuid().safeParse(jar.get(ANALYTICS_SESSION_COOKIE)?.value);
    const raw = jar.get(ANALYTICS_REFERRAL_COOKIE)?.value;
    const referral = raw ? referralSchema.safeParse(JSON.parse(raw)) : null;
    return {
      ...(session.success ? { session_id: session.data } : {}),
      ...(referral?.success ? { referral_session_id: referral.data.sessionId, referral_source: referral.data.source, referral_content: referral.data.content, attribution_model: "last_whatsapp_30d" } : {})
    };
  } catch { return {}; }
}
