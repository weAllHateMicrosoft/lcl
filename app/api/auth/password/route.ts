import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser, verifyPassword, hashPassword } from "@/lib/auth";

// Staff change their own password (must prove the current one).
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  if (!me.passwordHash) return NextResponse.json({ error: "student accounts have no password" }, { status: 400 });

  const { current, next } = await req.json();
  if (!verifyPassword(current || "", me.passwordHash)) {
    return NextResponse.json({ error: "Current password is wrong." }, { status: 401 });
  }
  if (typeof next !== "string" || next.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }
  await prisma.user.update({ where: { id: me.id }, data: { passwordHash: hashPassword(next) } });
  return NextResponse.json({ ok: true });
}
