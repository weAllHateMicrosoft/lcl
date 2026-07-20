import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { isEmailConfigured, issueCode, sendMail, consumeCode } from "@/lib/email";

// Forgot password. POST {email} → emails a reset code.
// POST {email, code, newPassword} → sets the new password + unlocks.
export async function POST(req: Request) {
  const { email, code, newPassword } = await req.json();
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!rateLimit(`forgot:${clientIp(req)}`, 6, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts — wait a few minutes." }, { status: 429 });
  }

  if (!code) {
    if (!(await isEmailConfigured())) return NextResponse.json({ error: "Email isn't set up — ask your teacher/admin to reset your password." }, { status: 501 });
    const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
    // Always answer the same whether or not the account exists (no probing).
    if (user) {
      const c = await issueCode(cleanEmail, "reset");
      try {
        await sendMail(cleanEmail, "classOS password reset", `Your password reset code is: ${c}\n\nIt expires in 15 minutes. If you didn't ask for this, ignore it.`);
      } catch {
        return NextResponse.json({ error: "Couldn't send email — try again later." }, { status: 502 });
      }
    }
    return NextResponse.json({ sent: true });
  }

  if (typeof newPassword !== "string" || newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be 8+ characters." }, { status: 400 });
  }
  const r = await consumeCode(cleanEmail, "reset", code);
  if (!r.ok) return NextResponse.json({ error: "Wrong or expired code." }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { email: cleanEmail } });
  if (!user) return NextResponse.json({ error: "Account not found." }, { status: 404 });
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hashPassword(newPassword), failedLogins: 0, lockedAt: null, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
  });
  return NextResponse.json({ ok: true });
}
