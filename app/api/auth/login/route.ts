import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, startSession } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { verifyTotp } from "@/lib/totp";
import { decryptSecret } from "@/lib/settings";
import { isEmailConfigured, issueCode, sendMail } from "@/lib/email";

const LOCK_AFTER = 8; // failed attempts before the account locks (admin can unlock)

// Everyone signs in with email + password. Extra gates when applicable:
// - locked account → 423 (admin unlocks, or password reset clears it)
// - TOTP enrolled (e.g. the admin) → requires the 6-digit authenticator code
// - unverified email (and SMTP on) → emails a code; /api/auth/verify finishes
export async function POST(req: Request) {
  const { email, password, totp } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "Email and password required." }, { status: 400 });

  const ip = clientIp(req);
  if (!rateLimit(`login:${ip}:${email}`, 8, 10 * 60 * 1000) || !rateLimit(`login:${ip}`, 30, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts — wait a few minutes." }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
  if (!user || !user.passwordHash) return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });

  if (user.lockedAt) {
    return NextResponse.json({ error: "This account is locked after too many failed attempts. Use “Forgot password”, or ask your teacher/admin to unlock it." }, { status: 423 });
  }

  if (!verifyPassword(password, user.passwordHash)) {
    const fails = user.failedLogins + 1;
    await prisma.user.update({ where: { id: user.id }, data: { failedLogins: fails, lockedAt: fails >= LOCK_AFTER ? new Date() : null } });
    return NextResponse.json({ error: fails >= LOCK_AFTER ? "Account locked after too many failed attempts." : "Wrong email or password." }, { status: 401 });
  }

  // Password OK. TOTP gate (Google Authenticator), if enrolled.
  if (user.totpSecret) {
    if (!totp) return NextResponse.json({ totpRequired: true });
    if (!verifyTotp(decryptSecret(user.totpSecret), totp)) {
      return NextResponse.json({ error: "Wrong authenticator code.", totpRequired: true }, { status: 401 });
    }
  }

  // Email-verification gate (only when we can actually send email).
  if (!user.emailVerifiedAt && (await isEmailConfigured())) {
    const code = await issueCode(user.email!, "verify");
    try {
      await sendMail(user.email!, "Your classOS verification code", `Your verification code is: ${code}\n\nIt expires in 15 minutes.`);
    } catch {
      /* SMTP hiccup: fall through and let them in rather than locking everyone out */
      await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0 } });
      await startSession(user.id);
      return NextResponse.json({ ok: true, role: user.role });
    }
    return NextResponse.json({ verifyRequired: true, email: user.email });
  }

  await prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0 } });
  await startSession(user.id);
  return NextResponse.json({ ok: true, role: user.role });
}
