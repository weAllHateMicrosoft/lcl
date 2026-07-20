import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRoleApi, makeJoinCode } from "@/lib/auth";
import type { User } from "@prisma/client";

// All class-management powers for teachers/admin. Every action verifies the
// caller owns the class (admin owns all). Actions: create, rename, delete,
// regenerateCode, removeStudent, renameStudent.

async function ownsClass(me: User, classId: string): Promise<boolean> {
  if (me.role === "ADMIN") return true;
  const c = await prisma.class.findUnique({ where: { id: classId } });
  return !!c && c.teacherId === me.id;
}

export async function POST(req: Request) {
  const me = await requireRoleApi("TEACHER", "ADMIN");
  if (me instanceof NextResponse) return me;
  const body = await req.json();

  switch (body.action) {
    case "create": {
      const name = String(body.name || "").trim().slice(0, 60);
      if (!name) return NextResponse.json({ error: "Class name required." }, { status: 400 });
      for (let i = 0; i < 5; i++) {
        try {
          const cls = await prisma.class.create({ data: { name, joinCode: makeJoinCode(), teacherId: me.id } });
          return NextResponse.json({ ok: true, class: cls });
        } catch {
          /* code collision — retry */
        }
      }
      return NextResponse.json({ error: "Could not create class." }, { status: 500 });
    }
    case "rename": {
      if (!(await ownsClass(me, body.classId))) return NextResponse.json({ error: "not your class" }, { status: 403 });
      await prisma.class.update({ where: { id: body.classId }, data: { name: String(body.name || "").trim().slice(0, 60) || "Untitled class" } });
      return NextResponse.json({ ok: true });
    }
    case "regenerateCode": {
      if (!(await ownsClass(me, body.classId))) return NextResponse.json({ error: "not your class" }, { status: 403 });
      // Invalidates the old code — students already joined stay joined.
      const code = makeJoinCode();
      await prisma.class.update({ where: { id: body.classId }, data: { joinCode: code } });
      return NextResponse.json({ ok: true, joinCode: code });
    }
    case "delete": {
      if (!(await ownsClass(me, body.classId))) return NextResponse.json({ error: "not your class" }, { status: 403 });
      // Remove the class's students (and their attempts, via cascade), then the class.
      await prisma.user.deleteMany({ where: { classId: body.classId, role: "STUDENT" } });
      await prisma.class.delete({ where: { id: body.classId } });
      return NextResponse.json({ ok: true });
    }
    case "removeStudent": {
      const student = await prisma.user.findUnique({ where: { id: body.studentId } });
      if (!student || student.role !== "STUDENT" || !student.classId) return NextResponse.json({ error: "not found" }, { status: 404 });
      if (!(await ownsClass(me, student.classId))) return NextResponse.json({ error: "not your student" }, { status: 403 });
      await prisma.user.delete({ where: { id: student.id } }); // cascades attempts/progress/messages
      return NextResponse.json({ ok: true });
    }
    case "renameStudent": {
      const student = await prisma.user.findUnique({ where: { id: body.studentId } });
      if (!student || student.role !== "STUDENT" || !student.classId) return NextResponse.json({ error: "not found" }, { status: 404 });
      if (!(await ownsClass(me, student.classId))) return NextResponse.json({ error: "not your student" }, { status: 403 });
      await prisma.user.update({ where: { id: student.id }, data: { name: String(body.name || "").trim().slice(0, 40) || student.name } });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}
