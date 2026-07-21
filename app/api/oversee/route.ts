import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { overseeStudent } from "@/lib/oversee";
import { rateLimit } from "@/lib/ratelimit";

// POST { studentId } → generate a fresh AI brief for that student.
// Teachers/admin: any student in their class(es). Students: themselves only
// (their "coach" note), politely rate-limited so it can't burn the quota.
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  const { studentId } = await req.json();
  if (!studentId) return NextResponse.json({ error: "studentId required" }, { status: 400 });

  if (me.role === "STUDENT") {
    if (studentId !== me.id) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    if (!rateLimit(`oversee:${me.id}`, 3, 10 * 60 * 1000)) {
      return NextResponse.json({ error: "Your coach just wrote to you — check back in a few minutes." }, { status: 429 });
    }
  } else {
    // staff: teacher must own the student's class; admin sees all
    const student = await prisma.user.findUnique({ where: { id: studentId }, include: { class: true } });
    if (!student) return NextResponse.json({ error: "student not found" }, { status: 404 });
    if (me.role === "TEACHER" && student.class?.teacherId !== me.id) {
      return NextResponse.json({ error: "not your student" }, { status: 403 });
    }
    if (!rateLimit(`oversee:${me.id}`, 30, 60 * 1000)) {
      return NextResponse.json({ error: "Slow down a little." }, { status: 429 });
    }
  }

  const r = await overseeStudent(studentId, me.id);
  if (r.error) return NextResponse.json({ error: r.error });
  return NextResponse.json({ insight: r.insight, createdAt: r.createdAt });
}
