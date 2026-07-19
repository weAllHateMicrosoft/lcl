// HTML hygiene for content that is NOT authored by the trusted admin:
// AI-generated quiz text and anything echoed back from students.

// Escape everything, then re-allow a tiny set of formatting tags (no attributes).
export function sanitizeInline(html: string): string {
  let s = String(html ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  for (const t of ["b", "i", "em", "strong", "code", "u"]) {
    s = s
      .replace(new RegExp(`&lt;${t}&gt;`, "gi"), `<${t}>`)
      .replace(new RegExp(`&lt;/${t}&gt;`, "gi"), `</${t}>`);
  }
  return s;
}

export function stripHtml(s: unknown): string {
  return String(s ?? "").replace(/<[^>]*>/g, "");
}
