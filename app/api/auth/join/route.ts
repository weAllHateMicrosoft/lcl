import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startSession } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/ratelimit";

const MAX_CLASS_SIZE = 100;

// Student join: class code + display name. Returning students who type the
// same name in the same class get their existing account (progress intact) —
// the deliberate classroom-simple tradeoff, visible to the teacher either way.
export async function POST(req: Request) {
  const { code, name } = await req.json();
  const cleanName = String(name || "").trim().slice(0, 40);
  const cleanCode = String(code || "").trim().toUpperCase();
  if (!cleanCode || cleanName.length < 2) {
    return NextResponse.json({ error: "Enter the class code and your name." }, { status: 400 });
  }

  // Guessing codes / spamming joins gets slow fast.
  if (!rateLimit(`join:${clientIp(req)}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts — wait a few minutes." }, { status: 429 });
  }

  const cls = await prisma.class.findUnique({ where: { joinCode: cleanCode } });
  if (!cls) return NextResponse.json({ error: "No class with that code — check with your teacher." }, { status: 404 });

  const existing = await prisma.user.findFirst({
    where: { classId: cls.id, role: "STUDENT", name: cleanName },
  });
  if (!existing) {
    const size = await prisma.user.count({ where: { classId: cls.id } });
    if (size >= MAX_CLASS_SIZE) return NextResponse.json({ error: "This class is full — tell your teacher." }, { status: 403 });
  }
  const student =
    existing ??
    (await prisma.user.create({
      data: { name: cleanName, role: "STUDENT", classId: cls.id },
    }));

  await startSession(student.id);
  return NextResponse.json({ ok: true, className: cls.name, returning: Boolean(existing) });
}
