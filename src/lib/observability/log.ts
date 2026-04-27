type LogLevel = "info" | "warn" | "error";

type LogContext = Record<string, unknown>;

type SerializedError = {
  name: string;
  message: string;
  stack?: string;
};

function serializeUnknown(value: unknown, depth = 0): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) return serializeError(value);
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "function" || typeof value === "symbol") return String(value);

  if (Array.isArray(value)) {
    if (depth >= 3) return "[array]";
    return value.map((item) => serializeUnknown(item, depth + 1));
  }

  if (typeof value === "object") {
    if (depth >= 3) return "[object]";
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, serializeUnknown(entryValue, depth + 1)])
    );
  }

  return String(value);
}

export function serializeError(error: unknown): SerializedError | { message: string } {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack
    };
  }

  return {
    message: typeof error === "string" ? error : JSON.stringify(serializeUnknown(error))
  };
}

function writeLog(level: LogLevel, event: string, context: LogContext = {}) {
  const serializedContext = serializeUnknown(context);
  const safeContext =
    serializedContext && typeof serializedContext === "object" && !Array.isArray(serializedContext)
      ? (serializedContext as LogContext)
      : { context: serializedContext };
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...safeContext
  };
  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}

export function logInfo(event: string, context?: LogContext) {
  writeLog("info", event, context);
}

export function logWarn(event: string, context?: LogContext) {
  writeLog("warn", event, context);
}

export function logError(event: string, error: unknown, context?: LogContext) {
  writeLog("error", event, {
    ...context,
    error: serializeError(error)
  });
}
