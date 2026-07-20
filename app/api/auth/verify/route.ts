import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startSession } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { consumeCode } from "@/lib/email";

// Redeem a 6-digit emailed code:
// - purpose "join": creates the pending student account, signs them in
// - purpose "verify": marks an existing account's email verified, signs in
export async function POST(req: Request) {
  const { email, code, purpose } = await req.json();
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!rateLimit(`verify:${clientIp(req)}:${cleanEmail}`, 8, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many tries — wait a few minutes." }, { status: 429 });
  }

  const p = purpose === "verify" ? "verify" : "join";
  const r = await consumeCode(cleanEmail, p, code);
  if (!r.ok) return NextResponse.json({ error: "Wrong or expired code." }, { status: 400 });

  if (p === "join") {
    const pay = r.payload as { classId: string; name: string; passwordHash: string };
    if (!pay?.classId) return NextResponse.json({ error: "Signup expired — start again." }, { status: 400 });
    const exists = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (exists) return NextResponse.json({ error: "That email already has an account." }, { status: 409 });
    const student = await prisma.user.create({
      data: { name: pay.name, email: cleanEmail, passwordHash: pay.passwordHash, role: "STUDENT", classId: pay.classId, emailVerifiedAt: new Date() },
    });
    await startSession(student.id);
    return NextResponse.json({ ok: true });
  }

  const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date(), failedLogins: 0 } });
  await startSession(user.id);
  return NextResponse.json({ ok: true, role: user.role });
}
