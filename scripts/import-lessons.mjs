// Pulls all 15 Unit 2 lessons out of the original prototype (classOS-lessons.html)
// and writes them as curriculum JSON the seed can load. No retyping — the demo
// content IS the source of truth.
//
//   node scripts/import-lessons.mjs
//   npm run db:seed        (picks up prisma/curriculum.seed.json automatically)

import { readFileSync, writeFileSync } from "node:fs";

const SRC = "classOS-lessons.html";
const OUT = "prisma/curriculum.seed.json";

const html = readFileSync(SRC, "utf8");

// Find the `const LESSONS = [ ... ]` array literal and extract it by walking
// characters with string/bracket awareness (so braces inside strings don't fool us).
const marker = html.indexOf("const LESSONS =");
if (marker === -1) throw new Error(`Couldn't find "const LESSONS =" in ${SRC}`);

const arrStart = html.indexOf("[", marker);
let depth = 0;
let inStr = false;
let strCh = "";
let esc = false;
let end = -1;
for (let i = arrStart; i < html.length; i++) {
  const c = html[i];
  if (inStr) {
    if (esc) esc = false;
    else if (c === "\\") esc = true;
    else if (c === strCh) inStr = false;
    continue;
  }
  if (c === '"' || c === "'" || c === "`") {
    inStr = true;
    strCh = c;
  } else if (c === "[" || c === "{" || c === "(") {
    depth++;
  } else if (c === "]" || c === "}" || c === ")") {
    depth--;
    if (depth === 0 && c === "]") {
      end = i + 1;
      break;
    }
  }
}
if (end === -1) throw new Error("Couldn't find the end of the LESSONS array");

const arrText = html.slice(arrStart, end);
// It's the prototype author's own literal data — evaluate it to a real array.
const LESSONS = new Function(`return (${arrText});`)();

// Legacy prototype blocks use `t:` keys — normalize to the canonical model.
function fromLegacy(b) {
  switch (b.t) {
    case "p": return { type: "prose", html: b.html };
    case "h": return { type: "heading", text: b.text };
    case "code": return { type: "code", code: b.code, out: b.out ?? "" };
    case "mistake":
    case "tip":
    case "note": return { type: "callout", kind: b.t, title: b.title ?? "", html: b.html ?? "" };
    case "terms": return { type: "terms", items: b.items ?? [] };
    case "check": return { type: "check", items: b.items ?? [] };
    case "try": return { type: "exercise", html: b.html ?? "", meta: b.meta ?? "" };
    default: return null;
  }
}

const lessons = LESSONS.map((L, idx) => ({
  code: L.id,
  order: idx,
  title: L.title,
  goal: L.goal ?? "",
  blocks: (L.body ?? []).map(fromLegacy).filter(Boolean),
  // exercise + quizBank are filled by the seed's EXTRAS (for authored lessons)
  // or later via the AI-authoring flow. Empty is fine — the reader handles it.
  exercise: {},
  quizBank: [],
}));

const out = { chapters: [{ order: 2, title: "Unit 2 — Basic Java", lessons }] };
writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(`Imported ${lessons.length} lessons from ${SRC} -> ${OUT}`);
console.log("Now run:  npm run db:seed");
