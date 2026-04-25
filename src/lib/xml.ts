export function escapeXmlText(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function escapeXmlAttribute(value: string) {
  return escapeXmlText(value)
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
