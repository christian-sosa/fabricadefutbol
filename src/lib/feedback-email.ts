import { getFeedbackFromEmail, getFeedbackInboxEmail, getResendApiKey } from "@/lib/env";
import { normalizeEmail } from "@/lib/org";

export type FeedbackCategory = "sugerencia" | "queja" | "error" | "otro";
export type FeedbackModule = "organizations" | "tournaments" | "both";

type SendFeedbackEmailInput = {
  fullName: string;
  email: string;
  category: FeedbackCategory;
  module: FeedbackModule;
  organization: string | null;
  message: string;
  submittedAtIso: string;
  userAgent: string | null;
  referer: string | null;
};

function categoryLabel(category: FeedbackCategory) {
  switch (category) {
    case "sugerencia":
      return "Sugerencia";
    case "queja":
      return "Queja";
    case "error":
      return "Reporte de error";
    default:
      return "Otro";
  }
}

function moduleLabel(module: FeedbackModule) {
  switch (module) {
    case "organizations":
      return "Grupos";
    case "tournaments":
      return "Torneos";
    default:
      return "General";
  }
}

function sanitizeMultilineText(value: string) {
  return value.replace(/\r\n/g, "\n").trim();
}

export async function sendFeedbackEmail(input: SendFeedbackEmailInput) {
  const resendApiKey = getResendApiKey();
  if (!resendApiKey) {
    throw new Error(
      "Falta RESEND_API_KEY para enviar mensajes de contacto. Configura RESEND_API_KEY en el servidor."
    );
  }

  const toEmail = getFeedbackInboxEmail();
  const fromEmail = getFeedbackFromEmail();
  const normalizedSenderEmail = normalizeEmail(input.email);
  const category = categoryLabel(input.category);
  const moduleName = moduleLabel(input.module);
  const subject = `[${category}][${moduleName}] Contacto Fabrica de Futbol`;
  const textBody = [
    `Categoria: ${category}`,
    `Tema: ${moduleName}`,
    `Nombre: ${input.fullName}`,
    `Email: ${normalizedSenderEmail}`,
    `Grupo / torneo: ${input.organization ?? "No informado"}`,
    `Enviado: ${input.submittedAtIso}`,
    `User-Agent: ${input.userAgent ?? "No informado"}`,
    `Referer: ${input.referer ?? "No informado"}`,
    "",
    "Mensaje:",
    sanitizeMultilineText(input.message)
  ].join("\n");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      reply_to: normalizedSenderEmail,
      subject,
      text: textBody
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Resend API error (${response.status}): ${details || "sin detalle"}`);
  }
}
