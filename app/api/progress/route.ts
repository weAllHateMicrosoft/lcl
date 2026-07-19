import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { recordAttempt } from "@/lib/progress";
import { ATTEMPT_KINDS } from "@/lib/roles";

export async function POST(req: Request) {
  const { lessonCode, kind, passed, score, detail } = await req.json();
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  if (!ATTEMPT_KINDS.includes(kind)) return NextResponse.json({ error: "bad kind" }, { status: 400 });
  // MASTERED must be unreachable from the client: summative attempts are graded
  // and recorded exclusively by /api/quiz, which holds the answer key.
  if (kind === "QUIZ_SUMMATIVE") {
    return NextResponse.json({ error: "summative quizzes are graded server-side" }, { status: 403 });
  }
  const lesson = await prisma.lesson.findUnique({ where: { code: lessonCode } });
  if (!lesson) return NextResponse.json({ error: "lesson not found" }, { status: 404 });

  const result = await recordAttempt({ userId: me.id, lessonId: lesson.id, kind, passed: !!passed, score, detail });
  return NextResponse.json(result);
}
