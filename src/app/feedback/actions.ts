"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { sendFeedbackEmail, type FeedbackModule } from "@/lib/feedback-email";
import { getCurrentUserIsSuperAdmin } from "@/lib/auth/super-admin";
import type { PublicModuleContext } from "@/lib/org";
import { normalizeEmail, withPublicQuery } from "@/lib/org";
import { checkRateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";

const feedbackSchema = z.object({
  fullName: z.string().trim().min(2, "Escribe tu nombre.").max(80, "El nombre es demasiado largo."),
  email: z.string().trim().email("Ingresa un email valido."),
  category: z.enum(["sugerencia", "queja", "error", "otro"]),
  module: z.enum(["organizations", "tournaments", "clubs", "both"]),
  organization: z
    .string()
    .trim()
    .max(80, "El nombre indicado es demasiado largo.")
    .optional(),
  message: z
    .string()
    .trim()
    .min(10, "El mensaje debe tener al menos 10 caracteres.")
    .max(2500, "Mensaje demasiado largo."),
  website: z.string().optional()
});

function normalizeFeedbackModule(
  value: FormDataEntryValue | null,
  fallback: PublicModuleContext
): FeedbackModule {
  if (value === "organizations" || value === "tournaments" || value === "clubs" || value === "both") {
    return value;
  }

  return fallback;
}

function toPageModule(module: FeedbackModule, fallback: PublicModuleContext): PublicModuleContext {
  if (module === "tournaments") return "tournaments";
  if (module === "organizations") return "organizations";
  if (module === "clubs") return "organizations";
  return fallback;
}

function buildFeedbackPath(params: {
  organizationKey: string | null;
  module: PublicModuleContext;
  intent?: "club" | null;
  sent?: boolean;
  error?: string;
}) {
  const basePath = withPublicQuery("/feedback", {
    organizationKey: params.organizationKey,
    module: params.module
  });

  const intentSeparator = basePath.includes("?") ? "&" : "?";
  const pathWithIntent = params.intent === "club"
    ? `${basePath}${intentSeparator}intent=club`
    : basePath;

  if (params.sent) {
    const separator = pathWithIntent.includes("?") ? "&" : "?";
    return `${pathWithIntent}${separator}sent=1`;
  }

  if (params.error) {
    const separator = pathWithIntent.includes("?") ? "&" : "?";
    return `${pathWithIntent}${separator}error=${encodeURIComponent(params.error)}`;
  }

  return pathWithIntent;
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

export async function submitFeedbackAction(
  organizationKey: string | null,
  defaultModule: PublicModuleContext,
  defaultIntent: "club" | null,
  formData: FormData
) {
  const canAccessTournaments = await getCurrentUserIsSuperAdmin();
  const submittedModule = normalizeFeedbackModule(formData.get("module"), defaultModule);
  const safeSubmittedModule =
    submittedModule === "tournaments" && !canAccessTournaments ? "organizations" : submittedModule;
  const pageModule = toPageModule(safeSubmittedModule, defaultModule);

  const parsed = feedbackSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    category: formData.get("category"),
    module: formData.get("module"),
    organization: formData.get("organization"),
    message: formData.get("message"),
    website: formData.get("website")
  });

  if (!parsed.success) {
    redirect(
      buildFeedbackPath({
        organizationKey,
        module: pageModule,
        intent: defaultIntent,
        error: parsed.error.issues[0]?.message ?? "No se pudo enviar tu mensaje."
      })
    );
  }

  if ((parsed.data.website ?? "").trim().length > 0) {
    redirect(
      buildFeedbackPath({
        organizationKey,
        module: pageModule,
        intent: defaultIntent,
        sent: true
      })
    );
  }

  const headerStore = await headers();
  const clientIp = getClientIpFromHeaders(headerStore);
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
        module: pageModule,
        intent: defaultIntent,
        error: `Enviaste demasiados mensajes seguidos. Proba de nuevo en ${retryMinutes} minuto(s).`
      })
    );
  }

  try {
    await sendFeedbackEmail({
      fullName: parsed.data.fullName,
      email: normalizeEmail(parsed.data.email),
      category: parsed.data.category,
      module: parsed.data.module === "tournaments" && !canAccessTournaments ? "organizations" : parsed.data.module,
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
        module: pageModule,
        intent: defaultIntent,
        error: buildFriendlyFeedbackErrorMessage(error)
      })
    );
  }

  redirect(
    buildFeedbackPath({
      organizationKey,
      module: pageModule,
      intent: defaultIntent,
      sent: true
    })
  );
}
