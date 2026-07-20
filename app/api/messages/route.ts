import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { allowedRecipients, canMessage } from "@/lib/messaging";
import { rateLimit } from "@/lib/ratelimit";
import { stripHtml } from "@/lib/sanitize";

// GET (no params)      → inbox summary: conversations + who I can write to
// GET ?with=<userId>   → the thread with that user (marks their msgs to me read)
// POST { toId, body }  → send a message
export async function GET(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const withId = new URL(req.url).searchParams.get("with");
  if (withId) {
    const thread = await prisma.message.findMany({
      where: { OR: [{ fromId: me.id, toId: withId }, { fromId: withId, toId: me.id }] },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    await prisma.message.updateMany({ where: { toId: me.id, fromId: withId, readAt: null }, data: { readAt: new Date() } });
    const other = await prisma.user.findUnique({ where: { id: withId } });
    return NextResponse.json({
      other: other ? { id: other.id, name: other.name, role: other.role } : null,
      messages: thread.map((m) => ({ id: m.id, mine: m.fromId === me.id, body: m.body, at: m.createdAt, kind: m.kind })),
    });
  }

  // summary: latest message per counterpart
  const all = await prisma.message.findMany({
    where: { OR: [{ toId: me.id }, { fromId: me.id }] },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { fromUser: true, toUser: true },
  });
  const seen = new Set<string>();
  const conversations: { userId: string; name: string; role: string; lastBody: string; lastAt: Date; unread: number }[] = [];
  for (const m of all) {
    const otherU = m.fromId === me.id ? m.toUser : m.fromUser;
    const otherId = m.fromId === me.id ? m.toId : m.fromId;
    if (!otherId || !otherU || seen.has(otherId)) continue;
    seen.add(otherId);
    const unread = all.filter((x) => x.fromId === otherId && x.toId === me.id && !x.readAt).length;
    conversations.push({ userId: otherId, name: otherU.name, role: otherU.role, lastBody: m.body, lastAt: m.createdAt, unread });
  }
  return NextResponse.json({ conversations, recipients: await allowedRecipients(me) });
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  if (!rateLimit(`msg:${me.id}`, 30, 60 * 1000)) {
    return NextResponse.json({ error: "Slow down a moment." }, { status: 429 });
  }

  const { toId, body, lessonCode } = await req.json();
  const text = stripHtml(body).trim().slice(0, 4000); // plain text only — no markup in messages
  if (!toId || !text) return NextResponse.json({ error: "message and recipient required" }, { status: 400 });
  if (!(await canMessage(me, toId))) return NextResponse.json({ error: "you can't message that person" }, { status: 403 });

  const msg = await prisma.message.create({ data: { fromId: me.id, toId, body: text, lessonCode: lessonCode || null, kind: "dm" } });
  return NextResponse.json({ ok: true, id: msg.id });
}
