"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { sendFeedbackEmail } from "@/lib/feedback-email";
import { normalizeEmail, withOrgQuery } from "@/lib/org";
import { checkRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";

const feedbackSchema = z.object({
  fullName: z.string().trim().min(2, "Escribe tu nombre.").max(80, "El nombre es demasiado largo."),
  email: z.string().trim().email("Ingresa un email valido."),
  category: z.enum(["sugerencia", "queja", "error", "otro"]),
  organization: z
    .string()
    .trim()
    .max(80, "El nombre de la organizacion es demasiado largo.")
    .optional(),
  message: z
    .string()
    .trim()
    .min(10, "El mensaje debe tener al menos 10 caracteres.")
    .max(2500, "Mensaje demasiado largo."),
  website: z.string().optional()
});

function buildFeedbackPath(params: { organizationKey: string | null; sent?: boolean; error?: string }) {
  const basePath = withOrgQuery("/feedback", params.organizationKey);
  if (params.sent) {
    const separator = basePath.includes("?") ? "&" : "?";
    return `${basePath}${separator}sent=1`;
  }

  if (params.error) {
    const separator = basePath.includes("?") ? "&" : "?";
    return `${basePath}${separator}error=${encodeURIComponent(params.error)}`;
  }

  return basePath;
}

function buildFriendlyFeedbackErrorMessage(error: unknown) {
  const fallback = "No se pudo enviar ahora mismo. Si sigue fallando, escribe directo a info@fabricadefutbol.com.ar.";
  if (!(error instanceof Error)) return fallback;

  const message = error.message.toLowerCase();
  if (message.includes("falta resend_api_key")) {
    return "El formulario de contacto todavia no esta configurado para enviar emails. Escribe directo a info@fabricadefutbol.com.ar.";
  }

  if (
    (message.includes("verify") && message.includes("domain")) ||
    message.includes("testing emails") ||
    message.includes("sender") ||
    message.includes("from address")
  ) {
    return "El remitente del formulario todavia no esta listo en Resend. Mientras tanto, escribe directo a info@fabricadefutbol.com.ar.";
  }

  return fallback;
}

export async function submitFeedbackAction(organizationKey: string | null, formData: FormData) {
  const parsed = feedbackSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    category: formData.get("category"),
    organization: formData.get("organization"),
    message: formData.get("message"),
    website: formData.get("website")
  });

  if (!parsed.success) {
    redirect(
      buildFeedbackPath({
        organizationKey,
        error: parsed.error.issues[0]?.message ?? "No se pudo enviar tu mensaje."
      })
    );
  }

  if ((parsed.data.website ?? "").trim().length > 0) {
    redirect(buildFeedbackPath({ organizationKey, sent: true }));
  }

  const headerStore = await headers();
  const clientIp = getClientIpFromHeaders(headerStore);
  // Max 3 envios por IP cada 5 minutos. Mitiga spam/abuso del formulario.
  const rateLimit = checkRateLimit({
    key: `feedback:${clientIp}`,
    limit: 3,
    windowMs: 5 * 60 * 1000
  });
  if (!rateLimit.allowed) {
    const retryMinutes = Math.max(1, Math.ceil(rateLimit.retryAfterMs / 60_000));
    redirect(
      buildFeedbackPath({
        organizationKey,
        error: `Enviaste demasiados mensajes seguidos. Probá de nuevo en ${retryMinutes} minuto(s).`
      })
    );
  }

  try {
    await sendFeedbackEmail({
      fullName: parsed.data.fullName,
      email: normalizeEmail(parsed.data.email),
      category: parsed.data.category,
      organization: parsed.data.organization?.trim() || null,
      message: parsed.data.message,
      submittedAtIso: new Date().toISOString(),
      userAgent: headerStore.get("user-agent"),
      referer: headerStore.get("referer")
    });
  } catch (error) {
    console.error("[feedback] No se pudo enviar el email de contacto", error);
    redirect(
      buildFeedbackPath({
        organizationKey,
        error: buildFriendlyFeedbackErrorMessage(error)
      })
    );
  }

  redirect(buildFeedbackPath({ organizationKey, sent: true }));
}
