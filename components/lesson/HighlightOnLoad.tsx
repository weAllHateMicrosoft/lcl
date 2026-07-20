"use client";

// When a lesson is opened with ?highlight=<text> (e.g. a teacher clicking a
// student's "Ask teacher" reference), find that passage in the lesson body,
// mark it, and scroll to it.
import { useEffect } from "react";

export default function HighlightOnLoad({ text }: { text: string }) {
  useEffect(() => {
    if (!text) return;
    const body = document.querySelector(".lesson-body");
    if (!body) return;

    // Try the full phrase, then progressively shorter prefixes (the selection
    // may have spanned multiple elements, so an exact single-node hit can fail).
    const candidates = [text, text.slice(0, 60), text.slice(0, 30), text.slice(0, 15)].map((s) => s.trim()).filter(Boolean);

    for (const needle of candidates) {
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const t = node.textContent || "";
        const idx = t.indexOf(needle);
        if (idx >= 0) {
          try {
            const range = document.createRange();
            range.setStart(node, idx);
            range.setEnd(node, Math.min(t.length, idx + needle.length));
            const mark = document.createElement("mark");
            mark.className = "lesson-highlight";
            range.surroundContents(mark);
            mark.scrollIntoView({ behavior: "smooth", block: "center" });
          } catch {
            (node.parentElement as HTMLElement)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }
          return;
        }
      }
    }
  }, [text]);

  return null;
}
