import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRoleApi } from "@/lib/auth";
import { normalizeQuestions } from "@/lib/curriculum/questions";
import { complete } from "@/lib/llm";
import type { User } from "@prisma/client";

async function ownsTest(me: User, testId: string) {
  if (me.role === "ADMIN") return true;
  const t = await prisma.test.findUnique({ where: { id: testId } });
  return !!t && t.ownerId === me.id;
}

// GET: everything needed to mark this test — questions + every submission.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireRoleApi("TEACHER", "ADMIN");
  if (me instanceof NextResponse) return me;
  if (!(await ownsTest(me, id))) return NextResponse.json({ error: "not yours" }, { status: 403 });

  const test = await prisma.test.findUnique({ where: { id } });
  const subs = await prisma.testSubmission.findMany({ where: { testId: id }, include: { user: true }, orderBy: { submittedAt: "asc" } });
  return NextResponse.json({
    title: test?.title,
    questions: normalizeQuestions((test?.questions as any[]) || []),
    submissions: subs.map((s) => ({
      id: s.id,
      name: s.user.name,
      answers: s.answers,
      results: s.results,
      autoScore: s.autoScore,
      maxScore: s.maxScore,
      finalScore: s.finalScore,
      status: s.status,
    })),
  });
}

// POST: save a graded submission, or ask the AI to suggest a mark for one answer.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireRoleApi("TEACHER", "ADMIN");
  if (me instanceof NextResponse) return me;
  if (!(await ownsTest(me, id))) return NextResponse.json({ error: "not yours" }, { status: 403 });
  const b = await req.json();

  if (b.action === "aiSuggest") {
    const r = await complete<{ score: number; feedback: string }>(
      {
        feature: "grade",
        system: `You are marking one exam answer. Return ONLY JSON: {"score": <number 0..${b.max}>, "feedback": "one or two sentences"}.
Question: ${b.question}
${b.rubric ? `Marking guide: ${b.rubric}` : ""}
Max marks: ${b.max}. Be fair and consistent; the teacher will confirm.`,
        messages: [{ role: "user", content: `Student answer:\n${b.answer || "(blank)"}` }],
        json: true,
        maxTokens: 2000,
      },
      { userId: me.id }
    );
    const score = Math.max(0, Math.min(b.max, Number(r.data?.score ?? 0)));
    return NextResponse.json({ score, feedback: r.data?.feedback || r.text, meta: `${r.provider}/${r.model}` });
  }

  // Save marks: b.results is the full QResult[] with teacher-set `awarded`.
  const results = b.results as { awarded: number }[];
  const finalScore = results.reduce((s, x) => s + (Number(x.awarded) || 0), 0);
  await prisma.testSubmission.update({
    where: { id: b.submissionId },
    data: { results: results as any, finalScore, status: "graded", gradedAt: new Date() },
  });
  return NextResponse.json({ ok: true, finalScore });
}
