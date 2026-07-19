import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, startSession } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// Staff sign-in (ADMIN / TEACHER) with email + password.
export async function POST(req: Request) {
  const { email, password } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "Email and password required." }, { status: 400 });

  // Brute-force guard: 5 tries per email+IP, 20 per IP, per 10 minutes.
  const ip = clientIp(req);
  if (!rateLimit(`login:${ip}:${email}`, 5, 10 * 60 * 1000) || !rateLimit(`login:${ip}`, 20, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts — wait a few minutes and try again." }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase().trim() } });
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "Wrong email or password." }, { status: 401 });
  }

  await startSession(user.id);
  return NextResponse.json({ ok: true, role: user.role });
}
