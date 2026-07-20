import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { recordAttempt } from "@/lib/progress";
import { normalizeQuestions, stripAnswers, type Question } from "@/lib/curriculum/questions";
import { gradeSubmission } from "@/lib/grading";

// The mastery ("clean") quiz — the ONLY path to MASTERED.
// Source: lesson.masteryQuiz (typed) if set, else the legacy quizBank (MCQ).
// Questions are served without answers; grading happens here on the server.
const PASS = 0.75;

function masteryQuestions(lesson: { masteryQuiz: unknown; quizBank: unknown }): Question[] {
  const mq = (lesson.masteryQuiz as any[]) || [];
  if (mq.length) return normalizeQuestions(mq);
  return normalizeQuestions((lesson.quizBank as any[]) || []);
}

export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const code = new URL(req.url).searchParams.get("lessonCode");
  const lesson = await prisma.lesson.findUnique({ where: { code: code || "" } });
  if (!lesson) return NextResponse.json({ error: "lesson not found" }, { status: 404 });

  const questions = masteryQuestions(lesson).map(stripAnswers);
  return NextResponse.json({ questions, passPct: PASS });
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { lessonCode, answers } = await req.json();
  const lesson = await prisma.lesson.findUnique({ where: { code: lessonCode || "" } });
  if (!lesson) return NextResponse.json({ error: "lesson not found" }, { status: 404 });

  const questions = masteryQuestions(lesson);
  if (!questions.length) return NextResponse.json({ error: "no mastery quiz for this lesson" }, { status: 400 });

  const { results } = await gradeSubmission(questions, answers || {});
  // Mastery is decided on auto-gradable questions (mcq/tf/short/code).
  const auto = results.filter((r) => r.auto);
  const awarded = auto.reduce((s, r) => s + r.awarded, 0);
  const max = auto.reduce((s, r) => s + r.max, 0);
  const score = max > 0 ? awarded / max : 0;
  const passed = score >= PASS;

  const qById = new Map(questions.map((q) => [q.id, q as any]));
  const detail = results.map((r) => {
    const q = qById.get(r.id);
    const a = (answers || {})[r.id];
    return {
      q: q?.q || "",
      picked: q?.type === "mcq" ? q.opts?.[Number(a)] ?? "—" : String(a ?? "—"),
      answer: q?.type === "mcq" ? q.opts?.[q.correct] ?? "" : q?.type === "tf" ? String(q.correct) : "",
      ok: r.correct ?? r.awarded >= r.max,
    };
  });

  const { status } = await recordAttempt({
    userId: me.id,
    lessonId: lesson.id,
    kind: "QUIZ_SUMMATIVE",
    passed,
    score,
    detail: { summative: true, questions: detail },
  });

  return NextResponse.json({ passed, score, awarded, max, status, results });
}
