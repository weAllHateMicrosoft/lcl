import "server-only";
import { runJava } from "@/lib/java/piston";

// ─── The interactive-lesson vocabulary ───────────────────────────────────────
//
// A flow is { v: 1, steps: FlowStep[] }. Each step is ONE screen: one-line
// instruction, one interaction, feedback, next. The gate is DOING, not reading
// — captions ("why"/"after") appear AFTER the reveal, where surprise teaches.
//
// 14 kinds, grouped by what the learner does:
//
//  watch & touch     run      press ▶, see it happen
//                    tweak    change the code, make the output yours
//                    note     one-beat divider card (no grading; use sparingly)
//  think-first       predict  tap what it prints, THEN see the reveal
//                    spot     tap the line (the bug / the one that prints X)
//                    trace    follow a variable: answer "x = ?" checkpoints
//  build             fix      broken code → make it match the target
//                    write    starter/blank → build the target from scratch
//                    arrange  tap shuffled lines into order (+ distractors)
//                    fill     code with ⟦1⟧⟦2⟧ blanks → tap the right chip
//  sort & connect    bucket   deal each item into the right bucket
//                    match    connect pairs (term↔meaning, code↔output)
//  talk it out       explain  convince the AI in a sentence — it judges/probes
//  flow control      branch   "seen this before?" → jump to another step
//
// Server-secret fields (never reach the browser; see stripStepForClient):
//   predict.correct/.why · spot.correct/.why · trace.questions[].correct/.why
//   fill.blanks[].answer/.why · bucket.items[].bucket/.why · match right-order
//   fix/write.solution · explain.rubric/.fallback
//
// Evidence: steps may carry `skills: ["statement", ...]` — the import tags the
// step id to those Skill rows so answers feed mastery + the overseer.

export type FlowStep = {
  id: string;
  kind: "run" | "tweak" | "note" | "predict" | "spot" | "trace" | "fix" | "write" | "arrange" | "fill" | "bucket" | "match" | "explain" | "branch";
  instruction: string;
  skills?: string[];
  hint?: string; // shown on demand after 1 failure
  after?: string; // one-line caption after success
  why?: string; // one-line caption after a graded reveal
  // per-kind payload (see validate below for exact requirements)
  code?: string;
  target?: string;
  opts?: string[];
  correct?: number;
  questions?: { prompt: string; opts: string[]; correct: number; why?: string }[];
  solution?: string;
  lines?: string[];
  distractors?: string[];
  blanks?: { chips: string[]; answer: number }[];
  buckets?: string[];
  items?: { text: string; bucket: number }[];
  pairs?: [string, string][];
  prompt?: string;
  rubric?: string;
  persona?: string;
  fallback?: string;
  options?: { label: string; goto: string }[];
};

export type Flow = { v: number; steps: FlowStep[] };

// ─── Structural validation (cheap, no network) ───────────────────────────────

export function validateFlow(flow: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const f = flow as Flow;
  if (!f || !Array.isArray(f.steps) || f.steps.length === 0) return { ok: false, errors: ["flow.steps must be a non-empty array"] };
  const ids = new Set<string>();
  for (const s of f.steps) {
    const at = `step "${s?.id || "?"}" (${s?.kind || "?"})`;
    if (!s.id || ids.has(s.id)) errors.push(`${at}: missing or duplicate id`);
    ids.add(s.id);
    if (!s.instruction) errors.push(`${at}: missing instruction`);
    switch (s.kind) {
      case "run": if (!s.code) errors.push(`${at}: needs code`); break;
      case "tweak": if (!s.code || s.target === undefined) errors.push(`${at}: needs code + target (the ORIGINAL output)`); break;
      case "note": break;
      case "predict":
        if (!s.code || !s.opts || s.opts.length < 2 || typeof s.correct !== "number" || !s.why) errors.push(`${at}: needs code, 2+ opts, correct, why`);
        else if (s.correct < 0 || s.correct >= s.opts.length) errors.push(`${at}: correct out of range`);
        break;
      case "spot":
        if (!s.code || typeof s.correct !== "number" || !s.why) errors.push(`${at}: needs code, correct (0-based line), why`);
        else if (s.correct >= s.code.split("\n").length) errors.push(`${at}: correct line ${s.correct} beyond code`);
        break;
      case "trace":
        if (!s.code || !s.questions?.length) errors.push(`${at}: needs code + questions[]`);
        for (const q of s.questions || []) if (!q.prompt || !q.opts || q.opts.length < 2 || typeof q.correct !== "number") errors.push(`${at}: bad trace question`);
        break;
      case "fix": case "write":
        if (!s.code && s.kind === "fix") errors.push(`${at}: needs code (the broken version)`);
        if (s.target === undefined) errors.push(`${at}: needs target`);
        if (!s.solution) errors.push(`${at}: needs solution (server-only; used to verify the step is solvable)`);
        break;
      case "arrange":
        if (!s.lines || s.lines.length < 2 || s.target === undefined) errors.push(`${at}: needs lines[] (in CORRECT order) + target`);
        break;
      case "fill":
        if (!s.code || !s.blanks?.length) errors.push(`${at}: needs code with ⟦1⟧… markers + blanks[]`);
        (s.blanks || []).forEach((b, i) => {
          if (!b.chips || b.chips.length < 2 || typeof b.answer !== "number" || b.answer < 0 || b.answer >= b.chips.length) errors.push(`${at}: bad blank ${i + 1}`);
          if (s.code && !s.code.includes(`⟦${i + 1}⟧`)) errors.push(`${at}: code missing ⟦${i + 1}⟧ marker`);
        });
        break;
      case "bucket":
        if (!s.buckets || s.buckets.length < 2 || !s.items?.length) errors.push(`${at}: needs buckets[] + items[]`);
        for (const it of s.items || []) if (typeof it.bucket !== "number" || it.bucket < 0 || it.bucket >= (s.buckets?.length || 0)) errors.push(`${at}: item "${it.text}" bad bucket index`);
        break;
      case "match":
        if (!s.pairs || s.pairs.length < 2) errors.push(`${at}: needs 2+ pairs`);
        break;
      case "explain":
        if (!s.prompt || !s.rubric) errors.push(`${at}: needs prompt + rubric`);
        break;
      case "branch":
        if (!s.options || s.options.length < 2) errors.push(`${at}: needs 2+ options`);
        for (const o of s.options || []) if (!ids.has(o.goto) && !f.steps.some((x) => x.id === o.goto)) errors.push(`${at}: goto "${o.goto}" doesn't exist`);
        break;
      default:
        errors.push(`${at}: unknown kind`);
    }
  }
  return { ok: errors.length === 0, errors };
}

// ─── Client stripping (the answer-key invariant) ─────────────────────────────

export function stripStepForClient(s: FlowStep): Record<string, unknown> {
  const base = { id: s.id, kind: s.kind, instruction: s.instruction, hint: s.hint, after: s.after, code: s.code, target: s.target };
  switch (s.kind) {
    case "predict": return { ...base, opts: s.opts };
    case "spot": return base;
    case "trace": return { ...base, questions: (s.questions || []).map((q) => ({ prompt: q.prompt, opts: q.opts })) };
    case "fix": case "write": return base; // solution stays server-side
    case "arrange": {
      // shuffle lines + mix in distractors so order isn't the giveaway
      const pool = [...(s.lines || []), ...(s.distractors || [])];
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      return { ...base, lines: pool, count: (s.lines || []).length };
    }
    case "fill": return { ...base, blanks: (s.blanks || []).map((b) => ({ chips: b.chips })) };
    case "bucket": return { ...base, buckets: s.buckets, items: (s.items || []).map((it) => ({ text: it.text })) };
    case "match": {
      const lefts = (s.pairs || []).map((p) => p[0]);
      const rights = (s.pairs || []).map((p) => p[1]);
      for (let i = rights.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [rights[i], rights[j]] = [rights[j], rights[i]]; }
      return { ...base, lefts, rights };
    }
    case "explain": return { ...base, prompt: s.prompt, persona: s.persona };
    case "branch": return { ...base, options: s.options };
    default: return base; // run / tweak / note
  }
}

// ─── Compiler verification (the anti-hallucination gate) ─────────────────────
//
// Runs every verifiable snippet through the REAL Java runner and checks the
// authored claims hold. An AI-authored lesson that lies about output teaches
// the exact misconception it exists to fix — so imports must pass this.

const norm = (x: string) => (x || "").replace(/\r\n/g, "\n").trimEnd();
const looksLikeError = (o: string) => /\berror\b/i.test(o);

export async function verifyFlow(flow: Flow): Promise<{ ok: boolean; results: string[]; failures: string[] }> {
  const results: string[] = [];
  const failures: string[] = [];
  const jobs = flow.steps.map(async (s) => {
    const name = `${s.id} (${s.kind})`;
    try {
      switch (s.kind) {
        case "run": {
          const r = await runJava(s.code!, "", { wrapBeginner: true });
          if (!r.compiled || r.error) failures.push(`${name}: does not run clean: ${(r.error || "").slice(0, 100)}`);
          else results.push(`${name}: ✓ runs, prints ${JSON.stringify(norm(r.stdout)).slice(0, 60)}`);
          break;
        }
        case "tweak": {
          const r = await runJava(s.code!, "", { wrapBeginner: true });
          if (!r.compiled || norm(r.stdout) !== norm(s.target!)) failures.push(`${name}: original output ${JSON.stringify(norm(r.stdout))} ≠ target ${JSON.stringify(norm(s.target!))}`);
          else results.push(`${name}: ✓ original verified`);
          break;
        }
        case "predict": {
          const r = await runJava(s.code!, "", { wrapBeginner: true });
          const claimed = s.opts![s.correct!];
          if (looksLikeError(claimed)) {
            if (r.compiled && !r.error) failures.push(`${name}: claims error but it runs fine, prints ${JSON.stringify(norm(r.stdout))}`);
            else results.push(`${name}: ✓ errors as claimed`);
          } else if (!r.compiled || r.error) failures.push(`${name}: doesn't run: ${(r.error || "").slice(0, 100)}`);
          else if (norm(r.stdout) !== norm(claimed)) failures.push(`${name}: prints ${JSON.stringify(norm(r.stdout))}, but correct opt says ${JSON.stringify(norm(claimed))}`);
          else results.push(`${name}: ✓ prints the correct option`);
          break;
        }
        case "fix": case "write": {
          const r = await runJava(s.solution!, "", { wrapBeginner: true });
          if (!r.compiled || norm(r.stdout) !== norm(s.target!)) failures.push(`${name}: solution gives ${JSON.stringify(norm(r.stdout || r.error))} ≠ target ${JSON.stringify(norm(s.target!))}`);
          else results.push(`${name}: ✓ solution reaches target`);
          if (s.kind === "fix" && s.code) {
            const broken = await runJava(s.code, "", { wrapBeginner: true });
            if (broken.compiled && !broken.error && norm(broken.stdout) === norm(s.target!)) failures.push(`${name}: the "broken" code already matches the target`);
          }
          break;
        }
        case "arrange": {
          const r = await runJava(s.lines!.join("\n"), "", { wrapBeginner: true });
          if (!r.compiled || norm(r.stdout) !== norm(s.target!)) failures.push(`${name}: correct order gives ${JSON.stringify(norm(r.stdout || r.error))} ≠ target ${JSON.stringify(norm(s.target!))}`);
          else results.push(`${name}: ✓ correct order reaches target`);
          break;
        }
        case "fill": {
          let assembled = s.code!;
          s.blanks!.forEach((b, i) => { assembled = assembled.split(`⟦${i + 1}⟧`).join(b.chips[b.answer]); });
          const r = await runJava(assembled, "", { wrapBeginner: true });
          if (!r.compiled || r.error) failures.push(`${name}: correct chips don't run: ${(r.error || "").slice(0, 100)}`);
          else if (s.target !== undefined && norm(r.stdout) !== norm(s.target)) failures.push(`${name}: correct chips print ${JSON.stringify(norm(r.stdout))} ≠ target`);
          else results.push(`${name}: ✓ correct chips verified`);
          break;
        }
        default:
          results.push(`${name}: – structural only`);
      }
    } catch (e) {
      failures.push(`${name}: verify crashed: ${(e as Error).message.slice(0, 80)}`);
    }
  });
  await Promise.all(jobs);
  return { ok: failures.length === 0, results, failures };
}
