export function deriveDisplayName(email: string, metadata?: Record<string, unknown>) {
  const fromMetadata =
    typeof metadata?.display_name === "string"
      ? metadata.display_name
      : typeof metadata?.name === "string"
        ? metadata.name
        : null;

  if (fromMetadata && fromMetadata.trim().length) {
    return fromMetadata.trim().slice(0, 80);
  }

  const localPart = email.split("@")[0] ?? "admin";
  return localPart.replace(/[._-]+/g, " ").trim().slice(0, 80) || "admin";
}
