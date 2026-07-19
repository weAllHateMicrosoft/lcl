// Defensive JSON extraction. Providers wrap JSON in ``` fences, add prose, or
// return the object mid-sentence. This centralizes the cleanup your prototype
// was doing by hand in three different places.

export function safeParseJson<T = unknown>(text: string): T | undefined {
  if (!text) return undefined;

  // 1. strip common markdown fences
  let s = text.replace(/```json/gi, "").replace(/```/g, "").trim();

  // 2. try straight parse
  try {
    return JSON.parse(s) as T;
  } catch {
    /* fall through */
  }

  // 3. grab the first balanced {...} or [...] object
  const start = s.search(/[{[]/);
  if (start === -1) return undefined;
  const open = s[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(s.slice(start, i + 1)) as T;
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}
