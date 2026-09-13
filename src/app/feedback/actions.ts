"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sendFeedbackEmail } from "@/lib/feedback-email";
import { normalizeEmail, withOrgQuery } from "@/lib/org";
import { checkRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";

const feedbackSchema = z.object({
  fullName: z.string().trim().min(2, "Escribí tu nombre.").max(80),
  email: z.string().trim().email("Ingresá un email válido."),
  category: z.enum(["sugerencia", "queja", "error", "otro", "multiple_groups", "setup_help"]),
  organization: z.string().trim().max(80).optional(),
  message: z.string().trim().min(10, "El mensaje debe tener al menos 10 caracteres.").max(2500),
  website: z.string().optional()
});

export async function submitFeedbackAction(organizationKey: string | null, _defaultModule: string, defaultIntent: "multiple_groups" | "setup_help" | null, formData: FormData) {
  const query = new URLSearchParams();
  if (defaultIntent) query.set("intent", defaultIntent);
  const base = withOrgQuery("/feedback", organizationKey);
  const path = (key: string, value: string) => {
    const destination = new URL(base, "https://local.invalid");
    query.forEach((item, name) => destination.searchParams.set(name, item));
    destination.searchParams.set(key, value);
    return `${destination.pathname}${destination.search}`;
  };
  const parsed = feedbackSchema.safeParse({ fullName: formData.get("fullName"), email: formData.get("email"), category: formData.get("category"), organization: formData.get("organization") ?? "", message: formData.get("message"), website: formData.get("website") ?? "" });
  if (!parsed.success) redirect(path("error", parsed.error.issues[0]?.message ?? "Revisá los datos."));
  if (parsed.data.website?.trim()) redirect(path("sent", "1"));
  const headerStore = await headers();
  const limit = checkRateLimit({ key: `feedback:${getClientIpFromHeaders(headerStore)}`, limit: 3, windowMs: 5 * 60_000 });
  if (!limit.allowed) redirect(path("error", "Enviaste varios mensajes seguidos. Esperá unos minutos."));
  try {
    await sendFeedbackEmail({ fullName: parsed.data.fullName, email: normalizeEmail(parsed.data.email), category: parsed.data.category, module: "organizations", organization: parsed.data.organization || null, message: parsed.data.message, submittedAtIso: new Date().toISOString(), userAgent: headerStore.get("user-agent"), referer: null });
  } catch {
    redirect(path("error", "No se pudo enviar el mensaje. Intentá nuevamente o escribí a info@fabricadefutbol.com.ar."));
  }
  redirect(path("sent", "1"));
}
