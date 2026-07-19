import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { recordAttempt } from "@/lib/progress";
import { ATTEMPT_KINDS } from "@/lib/roles";

export async function POST(req: Request) {
  const { lessonCode, kind, passed, score, detail } = await req.json();
  const me = await currentUser();

  if (!ATTEMPT_KINDS.includes(kind)) return NextResponse.json({ error: "bad kind" }, { status: 400 });
  const lesson = await prisma.lesson.findUnique({ where: { code: lessonCode } });
  if (!lesson) return NextResponse.json({ error: "lesson not found" }, { status: 404 });

  const result = await recordAttempt({ userId: me.id, lessonId: lesson.id, kind, passed: !!passed, score, detail });
  return NextResponse.json(result);
}
