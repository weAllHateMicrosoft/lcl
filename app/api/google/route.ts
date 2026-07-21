import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRoleApi } from "@/lib/auth";
import { listCourses, listStudents, createAnnouncement, disconnectUserGoogle } from "@/lib/google";
import { stripHtml } from "@/lib/sanitize";
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
    case "importRoster": {
      if (!(await ownsClass(me, b.classId))) return NextResponse.json({ error: "not your class" }, { status: 403 });
      const cls = await prisma.class.findUnique({ where: { id: b.classId } });
      if (!cls?.googleCourseId) return NextResponse.json({ error: "Link a Google course first." }, { status: 400 });
      const r = await listStudents(me.id, cls.googleCourseId);
      if (!r.ok) return NextResponse.json({ error: r.data?.error?.message || "Couldn't read the Google roster (reconnect Google to grant the email scope)." });

      let created = 0, linked = 0, skipped = 0;
      for (const s of r.data.students || []) {
        const email = (s.profile?.emailAddress || "").toLowerCase().trim();
        const name = s.profile?.name?.fullName || "Student";
        if (!email) { skipped++; continue; } // no email scope, or a teacher entry
        const existing = await prisma.user.findUnique({ where: { email } });
        if (existing) {
          if (existing.role === "STUDENT") { await prisma.user.update({ where: { id: existing.id }, data: { classId: cls.id } }); linked++; }
          else skipped++; // don't move staff into a class
        } else {
          // Passwordless "pending" account — activates when the student signs up
          // with this email, or logs in via Google (SSO, later). Email is trusted (from Google).
          await prisma.user.create({ data: { email, name, role: "STUDENT", classId: cls.id, emailVerifiedAt: new Date() } });
          created++;
        }
      }
      return NextResponse.json({ ok: true, created, linked, skipped });
    }
    case "announce": {
      if (!(await ownsClass(me, b.classId))) return NextResponse.json({ error: "not your class" }, { status: 403 });
      const text = stripHtml(b.text).trim().slice(0, 4000);
      if (!text) return NextResponse.json({ error: "Write something first." }, { status: 400 });
      const cls = await prisma.class.findUnique({ where: { id: b.classId }, include: { students: { select: { id: true } } } });
      if (!cls) return NextResponse.json({ error: "not found" }, { status: 404 });

      let google: { posted: boolean; error?: string } | null = null;
      if (cls.googleCourseId) {
        const r = await createAnnouncement(me.id, cls.googleCourseId, text);
        google = r.ok ? { posted: true } : { posted: false, error: r.data?.error?.message || `HTTP ${r.status}` };
      }
      // Also drop it in every student's classOS inbox.
      if (cls.students.length) {
        await prisma.message.createMany({ data: cls.students.map((s) => ({ fromId: me.id, toId: s.id, body: text, kind: "announcement" })) });
      }
      return NextResponse.json({ ok: true, google, sent: cls.students.length });
    }
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}
