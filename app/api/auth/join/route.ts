import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startSession, hashPassword } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { isEmailConfigured, issueCode, sendMail } from "@/lib/email";

const MAX_CLASS_SIZE = 100;

// Student signup: class code + name + email + password.
// With SMTP configured: a 6-digit code goes to the email; the account is
// created by /api/auth/verify. Without SMTP: account is created immediately
// (unverified) so the platform still works before email is set up.
export async function POST(req: Request) {
  const { code, name, email, password } = await req.json();
  const cleanName = String(name || "").trim().slice(0, 40);
  const cleanCode = String(code || "").trim().toUpperCase();
  const cleanEmail = String(email || "").trim().toLowerCase();

  if (!rateLimit(`join:${clientIp(req)}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts — wait a few minutes." }, { status: 429 });
  }
  if (!cleanCode || cleanName.length < 2) return NextResponse.json({ error: "Enter the class code and your name." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) return NextResponse.json({ error: "Enter a real email address." }, { status: 400 });
  if (typeof password !== "string" || password.length < 8) return NextResponse.json({ error: "Password must be 8+ characters." }, { status: 400 });

  const cls = await prisma.class.findUnique({ where: { joinCode: cleanCode } });
  if (!cls) return NextResponse.json({ error: "No class with that code — check with your teacher." }, { status: 404 });

  const taken = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (taken) return NextResponse.json({ error: "That email already has an account — sign in instead." }, { status: 409 });

  const size = await prisma.user.count({ where: { classId: cls.id } });
  if (size >= MAX_CLASS_SIZE) return NextResponse.json({ error: "This class is full — tell your teacher." }, { status: 403 });

  const passwordHash = hashPassword(password);

  if (await isEmailConfigured()) {
    const codeStr = await issueCode(cleanEmail, "join", { classId: cls.id, name: cleanName, passwordHash });
    try {
      await sendMail(cleanEmail, "Your classOS code", `Hi ${cleanName},\n\nYour verification code is: ${codeStr}\n\nIt expires in 15 minutes. If you didn't request this, ignore this email.`);
    } catch (e) {
      return NextResponse.json({ error: "Couldn't send the email — tell your teacher (SMTP problem)." }, { status: 502 });
    }
    return NextResponse.json({ pending: true, email: cleanEmail, className: cls.name });
  }

  // No SMTP yet — create directly (unverified) so classes can still run.
  const student = await prisma.user.create({
    data: { name: cleanName, email: cleanEmail, passwordHash, role: "STUDENT", classId: cls.id },
  });
  await startSession(student.id);
  return NextResponse.json({ ok: true, className: cls.name });
}
