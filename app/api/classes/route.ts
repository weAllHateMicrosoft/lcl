import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRoleApi, makeJoinCode } from "@/lib/auth";

// Create a class (teacher/admin). The join code is what students type at /join.
export async function POST(req: Request) {
  const me = await requireRoleApi("TEACHER", "ADMIN");
  if (me instanceof NextResponse) return me;

  const { name } = await req.json();
  const clean = String(name || "").trim().slice(0, 60);
  if (!clean) return NextResponse.json({ error: "Class name required." }, { status: 400 });

  // Retry on the (unlikely) join-code collision.
  for (let i = 0; i < 5; i++) {
    try {
      const cls = await prisma.class.create({ data: { name: clean, joinCode: makeJoinCode(), teacherId: me.id } });
      return NextResponse.json({ ok: true, class: cls });
    } catch {
      /* code collision — retry */
    }
  }
  return NextResponse.json({ error: "Could not create class, try again." }, { status: 500 });
}
