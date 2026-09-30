"use server";
import { headers } from "next/headers";
import { z } from "zod";
import { sendFeedbackEmail } from "@/lib/feedback-email";
import { normalizeEmail } from "@/lib/org";
import { getClientIpFromHeaders } from "@/lib/rate-limit";
import { checkSharedRateLimit } from "@/lib/shared-rate-limit";
import type { FeedbackState, FeedbackValues } from "./feedback-state";

const feedbackSchema = z.object({
  fullName: z.string().trim().min(2, "Escribí tu nombre.").max(80),
  email: z.string().trim().email("Ingresá un email válido.").max(254),
  category: z.enum(["sugerencia", "queja", "error", "otro", "multiple_groups", "setup_help"]),
  organization: z.string().trim().max(80).optional(),
  message: z.string().trim().min(10, "El mensaje debe tener al menos 10 caracteres.").max(2500),
  website: z.string().optional()
});

export async function submitFeedbackAction(_previous: FeedbackState, formData: FormData): Promise<FeedbackState> {
  const text = (name: string) => { const value = formData.get(name); return typeof value === "string" ? value : ""; };
  const raw = { fullName: text("fullName"), email: text("email"), category: text("category"), organization: text("organization"), message: text("message"), website: text("website") };
  const category = feedbackSchema.shape.category.safeParse(raw.category);
  const values: FeedbackValues = { fullName: raw.fullName, email: raw.email, category: category.success ? category.data : "sugerencia", organization: raw.organization, message: raw.message };
  const success: FeedbackState = { status: "success", message: "Recibimos tu mensaje. Gracias por escribirnos.", errors: {}, values };
  const parsed = feedbackSchema.safeParse(raw);
  if (!parsed.success) {
    const errors: FeedbackState["errors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0] as keyof FeedbackValues;
      if (field in values && !errors[field]) errors[field] = issue.message;
    }
    return { status: "error", message: "Revisá los campos indicados. Tu mensaje sigue acá.", errors, values };
  }
  if (parsed.data.website?.trim()) return success;
  try {
    const headerStore = await headers();
    const limit = await checkSharedRateLimit({ key: `feedback:${getClientIpFromHeaders(headerStore)}`, limit: 3, windowMs: 5 * 60_000 });
    if (!limit.allowed) return { status: "error", message: "Enviaste varios mensajes seguidos. Esperá unos minutos y volvé a intentar; conservamos lo que escribiste.", errors: {}, values };
    await sendFeedbackEmail({ fullName: parsed.data.fullName, email: normalizeEmail(parsed.data.email), category: parsed.data.category, module: "organizations", organization: parsed.data.organization || null, message: parsed.data.message, submittedAtIso: new Date().toISOString(), userAgent: headerStore.get("user-agent"), referer: null });
  } catch {
    return { status: "error", message: "No se pudo enviar el mensaje. Conservamos lo que escribiste para que puedas reintentar o escribir a info@fabricadefutbol.com.ar.", errors: {}, values };
  }
  return success;
}
