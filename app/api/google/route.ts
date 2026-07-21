import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRoleApi } from "@/lib/auth";
import { listCourses, disconnectUserGoogle } from "@/lib/google";
import type { User } from "@prisma/client";

// Google Classroom management for the connected teacher.
// GET  → their Google courses (for the link picker)
// POST → link/unlink a class to a course, or disconnect Google entirely.

async function ownsClass(me: User, classId: string) {
  if (me.role === "ADMIN") return true;
  const c = await prisma.class.findUnique({ where: { id: classId } });
  return !!c && c.teacherId === me.id;
}

export async function GET() {
  const me = await requireRoleApi("TEACHER", "ADMIN");
  if (me instanceof NextResponse) return me;
  const r = await listCourses(me.id);
  if (!r.ok) return NextResponse.json({ error: r.data?.error?.message || "Couldn't load your Google courses.", status: r.status }, { status: 200 });
  return NextResponse.json({ courses: (r.data.courses || []).map((c: any) => ({ id: c.id, name: c.name, section: c.section })) });
}

export async function POST(req: Request) {
  const me = await requireRoleApi("TEACHER", "ADMIN");
  if (me instanceof NextResponse) return me;
  const b = await req.json();

  switch (b.action) {
    case "disconnect": {
      await disconnectUserGoogle(me.id);
      return NextResponse.json({ ok: true });
    }
    case "link": {
      if (!(await ownsClass(me, b.classId))) return NextResponse.json({ error: "not your class" }, { status: 403 });
      await prisma.class.update({ where: { id: b.classId }, data: { googleCourseId: b.courseId, googleCourseName: b.courseName || null } });
      return NextResponse.json({ ok: true });
    }
    case "unlink": {
      if (!(await ownsClass(me, b.classId))) return NextResponse.json({ error: "not your class" }, { status: 403 });
      await prisma.class.update({ where: { id: b.classId }, data: { googleCourseId: null, googleCourseName: null } });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}
