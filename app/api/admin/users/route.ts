import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRoleApi, hashPassword } from "@/lib/auth";
import { makeJoinCode } from "@/lib/auth";

// Admin-only staff management: add / rename / remove teachers (and other admins).
export async function POST(req: Request) {
  const me = await requireRoleApi("ADMIN");
  if (me instanceof NextResponse) return me;
  const b = await req.json();

  switch (b.action) {
    case "addTeacher": {
      const email = String(b.email || "").toLowerCase().trim();
      const name = String(b.name || "").trim().slice(0, 60);
      const password = String(b.password || "");
      if (!email || !name) return NextResponse.json({ error: "Name and email required." }, { status: 400 });
      if (password.length < 8) return NextResponse.json({ error: "Password must be 8+ characters." }, { status: 400 });
      const exists = await prisma.user.findUnique({ where: { email } });
      if (exists) return NextResponse.json({ error: "That email is already in use." }, { status: 409 });
      await prisma.user.create({ data: { name, email, role: b.role === "ADMIN" ? "ADMIN" : "TEACHER", passwordHash: hashPassword(password) } });
      return NextResponse.json({ ok: true });
    }
    case "rename": {
      await prisma.user.update({ where: { id: b.id }, data: { name: String(b.name || "").trim().slice(0, 60) || "Unnamed" } });
      return NextResponse.json({ ok: true });
    }
    case "resetPassword": {
      const pw = makeJoinCode(4) + makeJoinCode(4); // 8-char temp
      await prisma.user.update({ where: { id: b.id }, data: { passwordHash: hashPassword(pw) } });
      return NextResponse.json({ ok: true, password: pw });
    }
    case "remove": {
      if (b.id === me.id) return NextResponse.json({ error: "You can't remove yourself." }, { status: 400 });
      const u = await prisma.user.findUnique({ where: { id: b.id } });
      if (!u || u.role === "STUDENT") return NextResponse.json({ error: "Not a staff account." }, { status: 400 });
      await prisma.user.delete({ where: { id: b.id } });
      return NextResponse.json({ ok: true });
    }
    default:
      return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
}
