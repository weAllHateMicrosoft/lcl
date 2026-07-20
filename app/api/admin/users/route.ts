import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRoleApi, hashPassword } from "@/lib/auth";

// Admin's absolute account control: every user (staff + students) — rename,
// change email, set a new password, unlock, verify, disable 2FA, add, remove.
export async function GET() {
  const me = await requireRoleApi("ADMIN");
  if (me instanceof NextResponse) return me;
  const users = await prisma.user.findMany({
    include: { class: { select: { name: true } } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      className: u.class?.name || null,
      verified: Boolean(u.emailVerifiedAt),
      locked: Boolean(u.lockedAt),
      totp: Boolean(u.totpSecret),
      createdAt: u.createdAt,
    })),
  });
}

export async function POST(req: Request) {
  const me = await requireRoleApi("ADMIN");
  if (me instanceof NextResponse) return me;
  const b = await req.json();

  switch (b.action) {
    case "addTeacher": {
      const email = String(b.email || "").toLowerCase().trim();
      const name = String(b.name || "").trim().slice(0, 60);
      if (!email || !name) return NextResponse.json({ error: "Name and email required." }, { status: 400 });
      if (String(b.password || "").length < 8) return NextResponse.json({ error: "Password must be 8+ characters." }, { status: 400 });
      if (await prisma.user.findUnique({ where: { email } })) return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
      await prisma.user.create({
        data: { name, email, role: b.role === "ADMIN" ? "ADMIN" : "TEACHER", passwordHash: hashPassword(b.password), emailVerifiedAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }
    case "rename": {
      await prisma.user.update({ where: { id: b.id }, data: { name: String(b.name || "").trim().slice(0, 60) || "Unnamed" } });
      return NextResponse.json({ ok: true });
    }
    case "setEmail": {
      const email = String(b.email || "").toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Invalid email." }, { status: 400 });
      const clash = await prisma.user.findUnique({ where: { email } });
      if (clash && clash.id !== b.id) return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
      await prisma.user.update({ where: { id: b.id }, data: { email, emailVerifiedAt: new Date() } }); // admin-set = trusted
      return NextResponse.json({ ok: true });
    }
    case "setPassword": {
      if (String(b.password || "").length < 8) return NextResponse.json({ error: "Password must be 8+ characters." }, { status: 400 });
      await prisma.user.update({ where: { id: b.id }, data: { passwordHash: hashPassword(b.password), failedLogins: 0, lockedAt: null } });
      return NextResponse.json({ ok: true });
    }
    case "unlock": {
      await prisma.user.update({ where: { id: b.id }, data: { lockedAt: null, failedLogins: 0 } });
      return NextResponse.json({ ok: true });
    }
    case "verify": {
      await prisma.user.update({ where: { id: b.id }, data: { emailVerifiedAt: new Date() } });
      return NextResponse.json({ ok: true });
    }
    case "disableTotp": {
      await prisma.user.update({ where: { id: b.id }, data: { totpSecret: null } });
      return NextResponse.json({ ok: true });
    }
    case "remove": {
      if (b.id === me.id) return NextResponse.json({ error: "You can't remove yourself." }, { status: 400 });
      await prisma.user.delete({ where: { id: b.id } });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}
