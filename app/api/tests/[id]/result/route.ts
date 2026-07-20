import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { normalizeQuestions } from "@/lib/curriculum/questions";

// A student's own result for a test — including the correct answers and the
// grader's feedback — but ONLY after the teacher releases results.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const test = await prisma.test.findUnique({ where: { id } });
  if (!test) return NextResponse.json({ error: "not found" }, { status: 404 });
  const sub = await prisma.testSubmission.findUnique({ where: { testId_userId: { testId: id, userId: me.id } } });
  if (!sub) return NextResponse.json({ error: "you haven't taken this test" }, { status: 404 });
  if (!test.resultsReleased) return NextResponse.json({ error: "Your teacher hasn't released results yet.", pending: true }, { status: 403 });

  const questions = normalizeQuestions(test.questions as any[]);
  const results = (sub.results as any[]) || [];
  const rById = new Map(results.map((r) => [r.id, r]));

  return NextResponse.json({
    title: test.title,
    finalScore: sub.finalScore,
    maxScore: sub.maxScore,
    status: sub.status,
    items: questions
      .filter((q) => q.type !== "info")
      .map((q) => {
        const r = rById.get(q.id);
        const a = (sub.answers as any)[q.id];
        return {
          type: q.type,
          q: (q as any).q,
          yourAnswer: q.type === "mcq" ? (q as any).opts?.[Number(a)] ?? "—" : q.type === "tf" ? String(a) : String(a ?? "—"),
          correctAnswer: modelAnswer(q),
          awarded: r?.awarded ?? 0,
          max: r?.max ?? q.points,
          note: r?.note || "",
        };
      }),
  });
}

function modelAnswer(q: any): string {
  switch (q.type) {
    case "mcq": return q.opts?.[q.correct] ?? "";
    case "tf": return String(q.correct);
    case "short": return (q.answers || []).join(" / ");
    case "code": return q.expected || "";
    case "long": return q.sampleAnswer || q.rubric || "";
    default: return "";
  }
}
