import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { recordAttempt } from "@/lib/progress";
import type { QuizQuestion } from "@/lib/curriculum/blocks";

// The summative ("clean") quiz, done honestly:
// - GET serves the questions WITHOUT answers (the bank never reaches the browser),
// - POST grades the picks server-side and records the attempt itself.
// This is the only path that can set MASTERED — /api/progress refuses summative.

const PASS = 0.75;

export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const code = new URL(req.url).searchParams.get("lessonCode");
  const lesson = await prisma.lesson.findUnique({ where: { code: code || "" } });
  if (!lesson) return NextResponse.json({ error: "lesson not found" }, { status: 404 });

  const bank = lesson.quizBank as unknown as QuizQuestion[];
  return NextResponse.json({
    questions: (bank || []).map((q) => ({ q: q.q, opts: q.opts })), // no correct, no why
    passPct: PASS,
  });
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { lessonCode, picks } = await req.json();
  const lesson = await prisma.lesson.findUnique({ where: { code: lessonCode || "" } });
  if (!lesson) return NextResponse.json({ error: "lesson not found" }, { status: 404 });

  const bank = lesson.quizBank as unknown as QuizQuestion[];
  if (!bank?.length) return NextResponse.json({ error: "no quiz for this lesson" }, { status: 400 });
  if (!Array.isArray(picks) || picks.length !== bank.length || picks.some((p) => !Number.isInteger(p))) {
    return NextResponse.json({ error: "answer every question" }, { status: 400 });
  }

  const results = bank.map((q, i) => ({ answerIndex: q.correct, ok: picks[i] === q.correct }));
  const correct = results.filter((r) => r.ok).length;
  const score = correct / bank.length;
  const passed = score >= PASS;

  const { status } = await recordAttempt({
    userId: me.id,
    lessonId: lesson.id,
    kind: "QUIZ_SUMMATIVE",
    passed,
    score,
    detail: {
      summative: true,
      questions: bank.map((q, i) => ({ q: q.q, picked: q.opts[picks[i]] ?? "—", answer: q.opts[q.correct], ok: picks[i] === q.correct })),
    },
  });

  return NextResponse.json({ passed, score, correct, total: bank.length, status, results });
}
