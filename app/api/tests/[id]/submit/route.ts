import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { normalizeQuestions } from "@/lib/curriculum/questions";
import { gradeSubmission } from "@/lib/grading";
import { logEvent, EVENT } from "@/lib/events";

// Student submits answers. Auto-gradable questions (mcq/tf/short/code) are
// graded now; long answers wait for the teacher. One submission per student.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const test = await prisma.test.findUnique({ where: { id } });
  if (!test || !test.published) return NextResponse.json({ error: "not available" }, { status: 403 });
  if (test.classId && test.classId !== me.classId) return NextResponse.json({ error: "not your class" }, { status: 403 });
  if (test.closeAt && Date.now() > test.closeAt.getTime()) return NextResponse.json({ error: "closed" }, { status: 403 });

  const existing = await prisma.testSubmission.findUnique({ where: { testId_userId: { testId: id, userId: me.id } } });
  if (existing) return NextResponse.json({ error: "already submitted" }, { status: 409 });

  const { answers } = await req.json();
  const questions = normalizeQuestions(test.questions as any[]);
  const { results, autoScore, maxScore, needsManual } = await gradeSubmission(questions, answers || {});

  await prisma.testSubmission.create({
    data: {
      testId: id,
      userId: me.id,
      answers: answers || {},
      results: results as any,
      autoScore,
      maxScore,
      finalScore: needsManual ? null : autoScore,
      status: needsManual ? "submitted" : "graded",
    },
  });

  // Analytics substrate (best-effort): the submission summary + item-level
  // answers. Learners only — staff never pollute the data.
  if (me.role === "STUDENT") {
    logEvent({ type: EVENT.TEST_SUBMIT, userId: me.id, classId: test.classId, testId: id, autoScore, maxScore, needsManual });
    for (const r of results) {
      logEvent({
        type: EVENT.QUIZ_ANSWER,
        userId: me.id,
        classId: test.classId,
        testId: id,
        questionId: r.id,
        correct: r.correct ?? r.awarded >= r.max,
        chosen: (answers || {})[r.id] ?? null,
        source: "test",
      });
    }
  }

  return NextResponse.json({ ok: true, autoScore, maxScore, needsManual });
}
