import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRoleApi } from "@/lib/auth";
import { normalizeQuestions, maxPoints } from "@/lib/curriculum/questions";
import { syncTestAssignment } from "@/lib/google";
import type { User } from "@prisma/client";

function originOf(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

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
      const publishing = b.published !== false;
      await prisma.test.update({ where: { id: b.id }, data: { published: publishing } });

      // Auto-sync to Google Classroom if this test's class is linked.
      let google: { synced: boolean; error?: string } | null = null;
      if (publishing) {
        const test = await prisma.test.findUnique({ where: { id: b.id }, include: { class: true } });
        if (test?.class?.googleCourseId && test.ownerId) {
          const r = await syncTestAssignment(test.ownerId, test.class.googleCourseId, {
            title: test.title,
            description: `Take this test in classOS. (Do not submit here — your marks come from classOS.)`,
            maxPoints: maxPoints(normalizeQuestions(test.questions as any[])),
            examUrl: `${originOf(req)}/exam/test/${test.id}`,
            closeAt: test.closeAt,
            existingId: test.googleCourseWorkId,
          });
          if (r.ok && r.id) {
            await prisma.test.update({ where: { id: test.id }, data: { googleCourseWorkId: r.id } });
            google = { synced: true };
          } else {
            google = { synced: false, error: r.error };
          }
        }
      }
      return NextResponse.json({ ok: true, google });
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
