import { NextResponse } from "next/server";
import { setCurrentUser } from "@/lib/auth";

// Dev role switcher. Replaced by Auth.js sign-in later.
export async function POST(req: Request) {
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  await setCurrentUser(userId);
  return NextResponse.json({ ok: true });
}
