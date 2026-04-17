type MaybePostgrestError = {
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

/**
 * Mapea errores de Supabase/Postgres a mensajes amigables en espanol para
 * mostrar al usuario final. Loguea el detalle tecnico en servidor y nunca
 * propaga texto crudo en ingles de la base hacia la UI.
 */
export function mapSupabaseError(error: unknown, fallback = "Ocurrio un error inesperado."): string {
  if (!error) return fallback;

  const candidate = (error instanceof Error ? error : (error as MaybePostgrestError)) as MaybePostgrestError & {
    message?: string;
  };
  const rawMessage = candidate.message ?? "";
  const code = candidate.code;

  if (typeof console !== "undefined") {
    console.error("[supabase] error", {
      code,
      message: rawMessage,
      details: candidate.details ?? null,
      hint: candidate.hint ?? null
    });
  }

  switch (code) {
    case "23505":
      return "Ya existe un registro con esos datos. Revisa los valores unicos e intenta de nuevo.";
    case "23503":
      return "No se puede completar la operacion por una dependencia entre tablas.";
    case "23502":
      return "Falta completar un campo obligatorio.";
    case "23514":
      return "Los datos enviados no cumplen una regla de validacion.";
    case "42501":
    case "PGRST301":
      return "No tenes permisos para realizar esta accion.";
    case "PGRST116":
      return "No se encontro el recurso solicitado.";
    case "22P02":
      return "Alguno de los valores enviados tiene un formato invalido.";
    default:
      break;
  }

  const lower = rawMessage.toLowerCase();
  if (lower.includes("duplicate key")) {
    return "Ya existe un registro con esos datos.";
  }
  if (lower.includes("violates foreign key")) {
    return "No se puede completar la operacion por una dependencia entre tablas.";
  }
  if (lower.includes("row-level security") || lower.includes("permission denied")) {
    return "No tenes permisos para realizar esta accion.";
  }
  if (lower.includes("jwt") || lower.includes("invalid api key")) {
    return "La sesion expiro o es invalida. Inicia sesion nuevamente.";
  }

  return fallback;
}

/**
 * Extrae un mensaje en espanol de cualquier error sin exponer detalle tecnico.
 * Util en catch {} de server actions y route handlers.
 */
export function toUserMessage(error: unknown, fallback = "Ocurrio un error inesperado."): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    return mapSupabaseError(error, fallback);
  }
  if (error instanceof Error && error.message) {
    // Mensajes que ya estan en espanol y no contienen detalle tecnico se dejan pasar.
    // Si el mensaje parece venir de Supabase/Postgres, se reemplaza por generico.
    const lower = error.message.toLowerCase();
    const looksTechnical =
      lower.includes("supabase") ||
      lower.includes("jwt") ||
      lower.includes("row-level") ||
      lower.includes("violates") ||
      lower.includes("duplicate key") ||
      lower.includes("relation \"") ||
      lower.includes("column \"");
    if (looksTechnical) {
      if (typeof console !== "undefined") console.error("[error] ", error);
      return fallback;
    }
    return error.message;
  }
  return fallback;
}
