// Normalize program output for output-based grading: trim, collapse trailing
// whitespace per line, unify newlines. Matches the prototype's `normalize`.
export function normalize(s: string): string {
  return (s ?? "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .trim();
}
