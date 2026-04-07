"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { sendFeedbackEmail } from "@/lib/feedback-email";
import { normalizeEmail, withOrgQuery } from "@/lib/org";

const feedbackSchema = z.object({
  fullName: z.string().trim().min(2, "Escribe tu nombre.").max(80, "El nombre es demasiado largo."),
  email: z.string().trim().email("Ingresa un email valido."),
  category: z.enum(["sugerencia", "queja", "error", "otro"]),
  organization: z
    .string()
    .trim()
    .max(80, "El nombre de la organizacion es demasiado largo.")
    .optional(),
  message: z.string().trim().min(10, "Describe un poco mas el detalle.").max(2500, "Mensaje demasiado largo."),
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

  try {
    const headerStore = headers();
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

    redirect(buildFeedbackPath({ organizationKey, sent: true }));
  } catch {
    redirect(
      buildFeedbackPath({
        organizationKey,
        error:
          "No se pudo enviar ahora mismo. Si sigue fallando, escribe directo a info@fabricadefutbol.com."
      })
    );
  }
}
