import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth";
import { complete } from "@/lib/llm";
import { sanitizeInline } from "@/lib/sanitize";
import type { Question } from "@/lib/curriculum/questions";

// AI test generation. Emits the SAME typed question JSON the builder uses, so
// generated questions are fully editable afterward. Subject-agnostic.
export async function POST(req: Request) {
  const me = await requireRoleApi("TEACHER", "ADMIN");
  if (me instanceof NextResponse) return me;
  const { prompt, count } = await req.json();

  const r = await complete<{ questions: any[] }>(
    {
      feature: "generate",
      system: `You write exam questions. Return ONLY JSON: {"questions":[...]}.
Each question is one of these shapes:
{"type":"mcq","q":"...","opts":["","","",""],"correct":0,"why":"...","points":1}
{"type":"tf","q":"...","correct":true,"why":"...","points":1}
{"type":"short","q":"...","answers":["accepted1","accepted2"],"points":1}
{"type":"code","q":"describe what to write","starter":"// optional starter code","expected":"the EXACT stdout the correct program prints","stdin":"","points":2}
Produce ${Math.min(15, Math.max(1, Number(count) || 5))} questions. "correct" is 0-based. Include coding questions when the topic is programming. Keep them clear and unambiguous. Ensure the JSON is complete.`,
      messages: [{ role: "user", content: String(prompt || "General knowledge, mixed types.") }],
      json: true,
      maxTokens: 8000,
    },
    { userId: me.id }
  );

  const uid = () => Math.random().toString(36).slice(2, 10);
  const questions: Question[] = (r.data?.questions || [])
    .map((q: any): Question | null => {
      const points = Number(q.points) || 1;
      if (q.type === "mcq" && Array.isArray(q.opts) && q.opts.length >= 2)
        return { id: uid(), type: "mcq", points, q: sanitizeInline(q.q || ""), opts: q.opts.map(sanitizeInline), correct: Number(q.correct) || 0, why: q.why ? sanitizeInline(q.why) : "" };
      if (q.type === "tf")
        return { id: uid(), type: "tf", points, q: sanitizeInline(q.q || ""), correct: Boolean(q.correct), why: q.why ? sanitizeInline(q.why) : "" };
      if (q.type === "short" && Array.isArray(q.answers))
        return { id: uid(), type: "short", points, q: sanitizeInline(q.q || ""), answers: q.answers.map((a: any) => String(a)) };
      if (q.type === "code")
        // starter/expected are code + literal output — keep raw (not HTML-escaped).
        return { id: uid(), type: "code", points, q: sanitizeInline(q.q || ""), starter: String(q.starter || ""), expected: String(q.expected || ""), stdin: String(q.stdin || "") };
      return null;
    })
    .filter(Boolean) as Question[];

  if (!questions.length) return NextResponse.json({ error: r.provider === "stub" ? "no AI key configured" : "model returned no usable questions" });
  return NextResponse.json({ questions });
}
