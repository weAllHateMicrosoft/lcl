import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startSession } from "@/lib/auth";
import { rateLimit, clientIp } from "@/lib/ratelimit";

// Anonymous practice entry — no name, no email, no class. Policy forbids
// registering real students or linking to a classroom, so this is the front
// door now: one click makes a private, unnamed learner identity (a plain
// signed session cookie, same mechanism as every other login) with no PII and
// no class link. Progress persists to THIS BROWSER only via that cookie —
// there is no roster, no teacher visibility, nothing to re-identify a person.
export async function POST(req: Request) {
  if (!rateLimit(`practice:${clientIp(req)}`, 8, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many attempts — wait a few minutes." }, { status: 429 });
  }
  const student = await prisma.user.create({ data: { name: randomName(), role: "STUDENT" } });
  await startSession(student.id);
  return NextResponse.json({ ok: true, name: student.name });
}

const ADJ = ["Swift", "Curious", "Bright", "Quiet", "Bold", "Clever", "Steady", "Sharp", "Calm", "Quick"];
const NOUN = ["Otter", "Falcon", "Fox", "Wren", "Lynx", "Heron", "Badger", "Comet", "Maple", "River"];

function randomName(): string {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const n = NOUN[Math.floor(Math.random() * NOUN.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${a} ${n} ${num}`;
}
