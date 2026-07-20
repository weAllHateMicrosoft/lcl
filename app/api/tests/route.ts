import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRoleApi } from "@/lib/auth";
import { normalizeQuestions, maxPoints } from "@/lib/curriculum/questions";
import type { User } from "@prisma/client";

// Test authoring (teacher/admin). GET lists your tests; POST does actions.
async function ownsTest(me: User, testId: string) {
  if (me.role === "ADMIN") return true;
  const t = await prisma.test.findUnique({ where: { id: testId } });
  return !!t && t.ownerId === me.id;
}

export async function GET() {
  const me = await requireRoleApi("TEACHER", "ADMIN");
  if (me instanceof NextResponse) return me;
  const tests = await prisma.test.findMany({
    where: me.role === "ADMIN" ? {} : { ownerId: me.id },
    include: { class: true, _count: { select: { submissions: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const classes = await prisma.class.findMany({ where: me.role === "ADMIN" ? {} : { teacherId: me.id } });
  return NextResponse.json({
    tests: tests.map((t) => ({
      id: t.id,
      title: t.title,
      className: t.class?.name || null,
      classId: t.classId,
      published: t.published,
      count: (t.questions as any[]).length,
      points: maxPoints(normalizeQuestions(t.questions as any[])),
      submissions: t._count.submissions,
    })),
    classes: classes.map((c) => ({ id: c.id, name: c.name })),
  });
}

export async function POST(req: Request) {
  const me = await requireRoleApi("TEACHER", "ADMIN");
  if (me instanceof NextResponse) return me;
  const b = await req.json();

  switch (b.action) {
    case "create": {
      const t = await prisma.test.create({ data: { title: b.title || "Untitled test", ownerId: me.id, questions: [] } });
      return NextResponse.json({ ok: true, id: t.id });
    }
    case "save": {
      if (!(await ownsTest(me, b.id))) return NextResponse.json({ error: "not yours" }, { status: 403 });
      await prisma.test.update({
        where: { id: b.id },
        data: {
          title: b.title,
          questions: b.questions ?? [],
          classId: b.classId || null,
          timeLimit: b.timeLimit ?? null,
          openAt: b.openAt ? new Date(b.openAt) : null,
          closeAt: b.closeAt ? new Date(b.closeAt) : null,
          requireSeb: b.requireSeb ?? false,
        },
      });
      return NextResponse.json({ ok: true });
    }
    case "publish": {
      if (!(await ownsTest(me, b.id))) return NextResponse.json({ error: "not yours" }, { status: 403 });
      await prisma.test.update({ where: { id: b.id }, data: { published: b.published !== false } });
      return NextResponse.json({ ok: true });
    }
    case "releaseResults": {
      if (!(await ownsTest(me, b.id))) return NextResponse.json({ error: "not yours" }, { status: 403 });
      await prisma.test.update({ where: { id: b.id }, data: { resultsReleased: b.released !== false } });
      return NextResponse.json({ ok: true });
    }
    case "delete": {
      if (!(await ownsTest(me, b.id))) return NextResponse.json({ error: "not yours" }, { status: 403 });
      await prisma.test.delete({ where: { id: b.id } });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}
