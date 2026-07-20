import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";

// Update your own profile: display name and avatar (a small data-URL image).
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const { name, avatar } = await req.json();
  const data: Record<string, unknown> = {};
  if (typeof name === "string" && name.trim()) data.name = name.trim().slice(0, 60);
  if (avatar === null) data.avatar = null;
  else if (typeof avatar === "string") {
    if (avatar.length > 260_000) return NextResponse.json({ error: "Image too large — pick a smaller one." }, { status: 400 });
    if (!avatar.startsWith("data:image/")) return NextResponse.json({ error: "Not an image." }, { status: 400 });
    data.avatar = avatar;
  }
  await prisma.user.update({ where: { id: me.id }, data });
  return NextResponse.json({ ok: true });
}
