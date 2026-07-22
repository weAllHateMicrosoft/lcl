import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { logEvent, EVENT } from "@/lib/events";
import { complete } from "@/lib/llm";
import { rateLimit } from "@/lib/ratelimit";
import { stripStepForClient, type FlowStep } from "@/lib/curriculum/flow";

// The interactive lesson flow. GET serves steps with every answer key STRIPPED
// (lib/curriculum/flow.ts is the single source of truth for what's secret);
// POST grades interactions server-side and logs the evidence stream.

async function loadFlow(lessonCode: string): Promise<{ lessonId: string; steps: FlowStep[] } | null> {
  const lesson = await prisma.lesson.findUnique({ where: { code: lessonCode }, select: { id: true, flow: true } });
  const steps = (lesson?.flow as any)?.steps as FlowStep[] | undefined;
  if (!lesson || !steps?.length) return null;
  return { lessonId: lesson.id, steps };
}

export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const lessonCode = new URL(req.url).searchParams.get("lessonCode") || "";
  const flow = await loadFlow(lessonCode);
  if (!flow) return NextResponse.json({ steps: [] });
  return NextResponse.json({ steps: flow.steps.map(stripStepForClient) });
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const body = await req.json();
  const flow = await loadFlow(String(body.lessonCode || ""));
  if (!flow) return NextResponse.json({ error: "no flow" }, { status: 404 });
  const step = flow.steps.find((s) => s.id === body.stepId);
  if (!step) return NextResponse.json({ error: "unknown step" }, { status: 404 });
  const isStudent = me.role === "STUDENT";
  const firstAttempt = Number(body.attempt) === 1;

  // Evidence rule: only a step's FIRST graded attempt counts (reveals teach;
  // retries aren't evidence). Learner signals only — staff previews don't log.
  const evidence = (correct: boolean) => {
    if (!isStudent || !firstAttempt) return;
    logEvent({ type: EVENT.QUIZ_ANSWER, userId: me.id, classId: me.classId, lessonId: flow.lessonId, questionId: step.id, correct, chosen: body.choice ?? null, source: "practice" });
    logEvent({ type: EVENT.FLOW_STEP, userId: me.id, classId: me.classId, lessonId: flow.lessonId, stepId: step.id, kind: step.kind, correct });
  };

  switch (body.action) {
    // predict + spot: one tap, one index
    case "answer": {
      if ((step.kind !== "predict" && step.kind !== "spot") || typeof step.correct !== "number") {
        return NextResponse.json({ error: "not an answerable step" }, { status: 400 });
      }
      const correct = Number(body.choice) === step.correct;
      evidence(correct);
      return NextResponse.json({ correct, correctIndex: step.correct, why: step.why || "" });
    }

    // trace: one sub-question at a time
    case "trace": {
      const q = step.questions?.[Number(body.qIndex)];
      if (step.kind !== "trace" || !q) return NextResponse.json({ error: "bad trace question" }, { status: 400 });
      const correct = Number(body.choice) === q.correct;
      if (isStudent && firstAttempt && Number(body.qIndex) === 0) evidence(correct); // one evidence row per step, from its first checkpoint
      return NextResponse.json({ correct, correctIndex: q.correct, why: q.why || "" });
    }

    // fill: all blanks at once → per-blank verdicts
    case "fill": {
      if (step.kind !== "fill" || !step.blanks) return NextResponse.json({ error: "not a fill step" }, { status: 400 });
      const choices = (body.choices || []) as number[];
      const verdicts = step.blanks.map((b, i) => choices[i] === b.answer);
      const allCorrect = verdicts.every(Boolean);
      evidence(allCorrect);
      return NextResponse.json({ correct: allCorrect, verdicts, answers: allCorrect ? undefined : step.blanks.map((b) => b.answer), why: allCorrect ? step.why || "" : "" });
    }

    // bucket: every item assigned → per-item verdicts
    case "bucket": {
      if (step.kind !== "bucket" || !step.items) return NextResponse.json({ error: "not a bucket step" }, { status: 400 });
      const assign = (body.assignments || []) as number[];
      const verdicts = step.items.map((it, i) => assign[i] === it.bucket);
      const allCorrect = verdicts.every(Boolean);
      evidence(allCorrect);
      return NextResponse.json({ correct: allCorrect, verdicts, answers: allCorrect ? undefined : step.items.map((it) => it.bucket), why: allCorrect ? step.why || "" : "" });
    }

    // match: pairs as [leftIndex, rightTEXT] — the mapping never left the server
    case "match": {
      if (step.kind !== "match" || !step.pairs) return NextResponse.json({ error: "not a match step" }, { status: 400 });
      const chosen = (body.pairs || []) as [number, string][];
      const verdicts = chosen.map(([li, rtext]) => step.pairs![li]?.[1] === rtext);
      const allCorrect = verdicts.every(Boolean) && chosen.length === step.pairs.length;
      evidence(allCorrect);
      return NextResponse.json({ correct: allCorrect, verdicts, why: allCorrect ? step.why || "" : "" });
    }

    // explain: the AI judges a one-sentence self-explanation against a rubric
    case "explain": {
      if (step.kind !== "explain") return NextResponse.json({ error: "not an explain step" }, { status: 400 });
      if (!rateLimit(`flowexplain:${me.id}`, 10, 60 * 1000)) return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
      const text = String(body.text || "").slice(0, 600);
      if (!text.trim()) return NextResponse.json({ error: "say something first" }, { status: 400 });
      try {
        const r = await complete<{ pass: boolean; reply: string }>(
          {
            feature: "grade",
            system: `You are ${step.persona || "a friendly beginner-programming study buddy"} inside an interactive lesson step. The student was asked: "${step.prompt}". Judge their explanation against this rubric (they must show they get the IDEA — wording doesn't matter, jargon not required): ${step.rubric}
Return ONLY JSON: {"pass": true|false, "reply": "one warm sentence — if pass: confirm + sharpen one detail; if fail: point at what's missing with a nudge, NEVER give the answer"}`,
            messages: [{ role: "user", content: text }],
            json: true,
            maxTokens: 400,
          },
          { userId: me.id }
        );
        if (typeof r.data?.pass !== "boolean") throw new Error("no verdict");
        evidence(r.data.pass);
        return NextResponse.json({ correct: r.data.pass, reply: r.data.reply || "" });
      } catch {
        // AI unavailable → don't block the lesson: accept, show the model line.
        evidence(true);
        return NextResponse.json({ correct: true, reply: step.fallback ? `Here's the key idea: ${step.fallback}` : "The judge is offline — moving on!" });
      }
    }

    // run/tweak/fix/arrange/write finishing (client-verified vs the visible
    // target; MASTERED still only comes from the server-graded clean quiz)
    case "complete": {
      const attempts = Math.max(1, Number(body.attempts) || 1);
      if (isStudent) {
        if (step.kind === "fix" || step.kind === "arrange" || step.kind === "write") {
          logEvent({ type: EVENT.QUIZ_ANSWER, userId: me.id, classId: me.classId, lessonId: flow.lessonId, questionId: step.id, correct: attempts <= 2, chosen: null, source: "practice" });
        }
        logEvent({ type: EVENT.FLOW_STEP, userId: me.id, classId: me.classId, lessonId: flow.lessonId, stepId: step.id, kind: step.kind, attempts });
      }
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}
