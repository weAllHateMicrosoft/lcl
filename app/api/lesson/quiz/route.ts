import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { gradeSubmission } from "@/lib/grading";
import { recordAttempt } from "@/lib/progress";
import { logEvent, EVENT } from "@/lib/events";
import { stripHtml } from "@/lib/sanitize";
import type { Block } from "@/lib/curriculum/blocks";

// Grade one in-lesson quiz block server-side (the block's answers never left the
// server). Formative: feeds readiness as a practice attempt, never mastery.
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { lessonCode, blockId, answers } = await req.json();
  const lesson = await prisma.lesson.findUnique({ where: { code: lessonCode } });
  if (!lesson) return NextResponse.json({ error: "lesson not found" }, { status: 404 });

  const blocks = lesson.blocks as unknown as Block[];
  const block = blocks.find((b) => b.type === "quiz" && b.id === blockId);
  if (!block || block.type !== "quiz") return NextResponse.json({ error: "quiz not found" }, { status: 404 });

  const { results } = await gradeSubmission(block.questions, answers || {});

  // Score over auto-gradable questions only (long/essay aren't marked here).
  const auto = results.filter((r) => r.auto);
  const awarded = auto.reduce((s, r) => s + r.awarded, 0);
  const max = auto.reduce((s, r) => s + r.max, 0);
  const score = max > 0 ? awarded / max : 1;

  // Per-question detail for the teacher's student record.
  const qById = new Map(block.questions.map((q) => [q.id, q as any]));
  const detailQuestions = results.map((r) => {
    const q = qById.get(r.id);
    const a = (answers || {})[r.id];
    return {
      q: stripHtml(q?.q || ""),
      ok: r.correct ?? r.awarded >= r.max,
      picked: q?.type === "mcq" ? stripHtml(q.opts?.[Number(a)] ?? "—") : stripHtml(String(a ?? "—")),
      answer: q?.type === "mcq" ? stripHtml(q.opts?.[q.correct] ?? "") : q?.type === "tf" ? String(q.correct) : "",
    };
  });

  await recordAttempt({
    userId: me.id,
    lessonId: lesson.id,
    kind: "QUIZ_PRACTICE",
    passed: score >= 0.7,
    score,
    detail: { questions: detailQuestions, block: title(block) },
  });

  // Analytics substrate: item-level answers — the load-bearing signal. Records
  // which distractor was chosen (the "why" behind a wrong answer). skillIds are
  // added later once question→skill tagging exists; forward-compatible now.
  for (const r of results) {
    logEvent({
      type: EVENT.QUIZ_ANSWER,
      userId: me.id,
      classId: me.classId,
      lessonId: lesson.id,
      questionId: r.id,
      correct: r.correct ?? r.awarded >= r.max,
      chosen: (answers || {})[r.id] ?? null,
      source: "practice",
    });
  }

  return NextResponse.json({ results, awarded, max });
}

function title(b: Extract<Block, { type: "quiz" }>): string {
  return b.title || "In-lesson quiz";
}
