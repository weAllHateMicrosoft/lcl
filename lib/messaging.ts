import "server-only";
import { prisma } from "./db";
import type { User } from "@prisma/client";

// Who may message whom:
// - ADMIN ↔ anyone
// - TEACHER ↔ students in their own classes (+ any admin)
// - STUDENT ↔ the teacher of their class (+ any admin)
// This keeps students from DMing each other or teachers they don't have.

export async function allowedRecipients(me: User): Promise<{ id: string; name: string; role: string; sub?: string }[]> {
  if (me.role === "ADMIN") {
    const users = await prisma.user.findMany({ where: { id: { not: me.id } }, include: { class: true }, orderBy: [{ role: "asc" }, { name: "asc" }] });
    return users.map((u) => ({ id: u.id, name: u.name, role: u.role, sub: u.class?.name || u.email || undefined }));
  }
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" } });
  if (me.role === "TEACHER") {
    const classes = await prisma.class.findMany({ where: { teacherId: me.id }, include: { students: true } });
    const students = classes.flatMap((c) => c.students.map((s) => ({ id: s.id, name: s.name, role: "STUDENT", sub: c.name })));
    return [...students, ...admins.map((a) => ({ id: a.id, name: a.name, role: "ADMIN", sub: "admin" }))];
  }
  // STUDENT
  const recips: { id: string; name: string; role: string; sub?: string }[] = [];
  if (me.classId) {
    const cls = await prisma.class.findUnique({ where: { id: me.classId }, include: { teacher: true } });
    if (cls?.teacher) recips.push({ id: cls.teacher.id, name: cls.teacher.name, role: "TEACHER", sub: "your teacher" });
  }
  recips.push(...admins.map((a) => ({ id: a.id, name: a.name, role: "ADMIN", sub: "admin" })));
  return recips;
}

export async function canMessage(me: User, toId: string): Promise<boolean> {
  return (await allowedRecipients(me)).some((r) => r.id === toId);
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.message.count({ where: { toId: userId, readAt: null } });
}
