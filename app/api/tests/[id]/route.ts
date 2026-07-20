import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { normalizeQuestions, stripAnswers } from "@/lib/curriculum/questions";

// Load one test. Teachers/owner get the full thing (answers included, to edit);
// a student assigned to it gets the answer-stripped version to take.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const test = await prisma.test.findUnique({ where: { id }, include: { class: true } });
  if (!test) return NextResponse.json({ error: "not found" }, { status: 404 });
  const questions = normalizeQuestions(test.questions as any[]);

  const isOwner = me.role === "ADMIN" || test.ownerId === me.id;
  if (isOwner) {
    return NextResponse.json({ owner: true, test: { id: test.id, title: test.title, questions, classId: test.classId, timeLimit: test.timeLimit, openAt: test.openAt, closeAt: test.closeAt, published: test.published } });
  }

  // student path
  if (!test.published) return NextResponse.json({ error: "not open" }, { status: 403 });
  if (test.classId && test.classId !== me.classId) return NextResponse.json({ error: "not assigned to your class" }, { status: 403 });
  const now = Date.now();
  if (test.openAt && now < test.openAt.getTime()) return NextResponse.json({ error: "not open yet" }, { status: 403 });
  if (test.closeAt && now > test.closeAt.getTime()) return NextResponse.json({ error: "closed" }, { status: 403 });

  const existing = await prisma.testSubmission.findUnique({ where: { testId_userId: { testId: id, userId: me.id } } });
  return NextResponse.json({
    owner: false,
    alreadyDone: !!existing,
    test: { id: test.id, title: test.title, timeLimit: test.timeLimit, questions: questions.map(stripAnswers) },
  });
}
