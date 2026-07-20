"use client";

// Jump to + highlight the passage a student referenced (?highlight=...).
// Uses window.find so it works even when the selection spans multiple inline
// elements (e.g. a sentence containing <code> or <strong>), then wraps every
// text node the match touches — the previous single-node version silently
// failed on almost any real selection.
import { useEffect } from "react";

export default function HighlightOnLoad({ text }: { text: string }) {
  useEffect(() => {
    if (!text) return;
    const body = document.querySelector(".lesson-body") as HTMLElement | null;
    if (!body) return;

    const clean = text.replace(/\s+/g, " ").trim();
    const candidates = [clean, clean.slice(0, 80), clean.slice(0, 40), clean.slice(0, 20)].filter((s, i, a) => s.length > 3 && a.indexOf(s) === i);

    for (const needle of candidates) {
      if (tryHighlight(body, needle)) return;
    }
  }, [text]);

  return null;
}

function tryHighlight(body: HTMLElement, needle: string): boolean {
  const sel = window.getSelection();
  if (!sel) return false;
  sel.removeAllRanges();
  // start searching from the top of the lesson body
  const start = document.createRange();
  start.setStart(body, 0);
  start.collapse(true);
  sel.addRange(start);

  // window.find(text, caseSensitive, backwards, wrapAround, ...)
  const found = typeof (window as any).find === "function" && (window as any).find(needle, false, false, true, false, false, false);
  if (!found) {
    sel.removeAllRanges();
    return false;
  }
  const range = sel.getRangeAt(0);
  if (!body.contains(range.commonAncestorContainer)) {
    sel.removeAllRanges();
    return false;
  }
  const first = wrapRange(range);
  sel.removeAllRanges();
  const target = first || (range.startContainer.parentElement as HTMLElement | null);
  target?.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}

// Wrap every text node the range touches in <mark> (handles cross-element matches).
function wrapRange(range: Range): HTMLElement | null {
  const nodes: Text[] = [];
  const walker = document.createTreeWalker(range.commonAncestorContainer, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = walker.nextNode())) {
    if (range.intersectsNode(n)) nodes.push(n as Text);
  }
  let first: HTMLElement | null = null;
  for (const node of nodes) {
    const r = document.createRange();
    r.selectNodeContents(node);
    if (node === range.startContainer) r.setStart(node, range.startOffset);
    if (node === range.endContainer) r.setEnd(node, range.endOffset);
    if (r.collapsed) continue;
    try {
      const mark = document.createElement("mark");
      mark.className = "lesson-highlight";
      r.surroundContents(mark);
      if (!first) first = mark;
    } catch {
      /* skip nodes that can't be cleanly wrapped */
    }
  }
  return first;
}
