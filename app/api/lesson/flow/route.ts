import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { logEvent, EVENT } from "@/lib/events";

// The interactive lesson flow (do-first steps, near-zero text).
//
// GET  ?lessonCode=2.1        → steps with predict answers STRIPPED (the
//                               platform invariant: answer keys never reach the
//                               browser before the student answers).
// POST { action:"answer" }    → server-grades a predict tap, returns the
//                               correct index + the one-line why, logs evidence.
// POST { action:"complete" }  → records a run/tweak/fix/arrange/write step
//                               finishing (client-verified against the visible
//                               target output — nothing secret to protect;
//                               MASTERED still only comes from the server-graded
//                               summative quiz, so this stays informational).

type FlowStep = {
  id: string;
  kind: "run" | "tweak" | "predict" | "fix" | "arrange" | "write";
  instruction: string;
  code?: string;
  opts?: string[];
  correct?: number;
  why?: string;
  target?: string;
  lines?: string[];
  hint?: string;
  after?: string;
};

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

  // Strip what must not ship: the predict answer key + its reveal line.
  const steps = flow.steps.map((s) =>
    s.kind === "predict" ? { ...s, correct: undefined, why: undefined } : s
  );
  return NextResponse.json({ steps });
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

  if (body.action === "answer") {
    if (step.kind !== "predict" || typeof step.correct !== "number") {
      return NextResponse.json({ error: "not a predict step" }, { status: 400 });
    }
    const choice = Number(body.choice);
    const correct = choice === step.correct;
    // Evidence: only the FIRST tap on a step counts (attempt 1); reveals teach,
    // retries aren't evidence. Learner signals only — staff previews don't log.
    if (isStudent && Number(body.attempt) === 1) {
      logEvent({ type: EVENT.QUIZ_ANSWER, userId: me.id, classId: me.classId, lessonId: flow.lessonId, questionId: step.id, correct, chosen: choice, source: "practice" });
      logEvent({ type: EVENT.FLOW_STEP, userId: me.id, classId: me.classId, lessonId: flow.lessonId, stepId: step.id, kind: step.kind, correct });
    }
    return NextResponse.json({ correct, correctIndex: step.correct, why: step.why || "" });
  }

  if (body.action === "complete") {
    const attempts = Math.max(1, Number(body.attempts) || 1);
    // Doing-steps count as skill evidence when tagged (fix/arrange/write):
    // succeeding within 2 tries reads as "can do it", more reads as "struggled".
    if (isStudent) {
      if (step.kind === "fix" || step.kind === "arrange" || step.kind === "write") {
        logEvent({ type: EVENT.QUIZ_ANSWER, userId: me.id, classId: me.classId, lessonId: flow.lessonId, questionId: step.id, correct: attempts <= 2, chosen: null, source: "practice" });
      }
      logEvent({ type: EVENT.FLOW_STEP, userId: me.id, classId: me.classId, lessonId: flow.lessonId, stepId: step.id, kind: step.kind, attempts });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
