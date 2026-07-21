import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRoleApi } from "@/lib/auth";
import { normalizeQuestions } from "@/lib/curriculum/questions";
import { complete } from "@/lib/llm";
import { pushGrade } from "@/lib/google";
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
    resultsReleased: test?.resultsReleased ?? false,
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
    // Works for essays (rubric) and code (expected output / behaviour). The
    // teacher always confirms or overrides — this is only a suggestion.
    const r = await complete<{ score: number; feedback: string }>(
      {
        feature: "grade",
        system: `You are marking one exam answer. Return ONLY JSON, nothing else: {"score": <number 0..${b.max}>, "feedback": "<max 40 words, plain ASCII quotes>"}.
Question: ${b.question}
${b.rubric ? `Marking guide: ${b.rubric}` : ""}
${b.expected ? `Expected output / correct answer: ${b.expected}` : ""}
${b.isCode ? "This is a coding question — judge whether the logic is correct even if the output isn't a perfect match; note any bug briefly." : ""}
Max marks: ${b.max}. Be fair and consistent. Keep feedback short so the JSON is complete.`,
        messages: [{ role: "user", content: `Student answer:\n${b.answer || "(blank)"}` }],
        json: true,
        // Generous: thinking models spend hidden reasoning tokens in this budget;
        // too small = truncated JSON = the raw-JSON-in-feedback bug.
        maxTokens: 6000,
      },
      { userId: me.id }
    );
    // If parsing failed, DON'T dump raw JSON into the feedback box.
    if (!r.data || typeof r.data.score === "undefined") {
      return NextResponse.json({ error: "The AI reply couldn't be read (it may have been cut off). Try again, or mark it yourself." });
    }
    const score = Math.max(0, Math.min(b.max, Number(r.data.score) || 0));
    return NextResponse.json({ score, feedback: String(r.data.feedback || "").trim(), meta: `${r.provider}/${r.model}` });
  }

  // Save marks: b.results is the full QResult[] with teacher-set `awarded`.
  const results = b.results as { awarded: number }[];
  const finalScore = results.reduce((s, x) => s + (Number(x.awarded) || 0), 0);
  const sub = await prisma.testSubmission.update({
    where: { id: b.submissionId },
    data: { results: results as any, finalScore, status: "graded", gradedAt: new Date() },
    include: { user: true },
  });

  // Push the grade to Google Classroom if this test is synced.
  let google: { pushed: boolean; error?: string } | null = null;
  const test = await prisma.test.findUnique({ where: { id }, include: { class: true } });
  if (test?.googleCourseWorkId && test.class?.googleCourseId && test.ownerId && sub.user.email) {
    const r = await pushGrade(test.ownerId, test.class.googleCourseId, test.googleCourseWorkId, sub.user.email, finalScore);
    google = r.ok ? { pushed: true } : { pushed: false, error: r.error };
  }
  return NextResponse.json({ ok: true, finalScore, google });
}
