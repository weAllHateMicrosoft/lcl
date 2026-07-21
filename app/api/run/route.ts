import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { runJava } from "@/lib/java/piston";
import { rateLimit } from "@/lib/ratelimit";
import { logEvent, EVENT } from "@/lib/events";

// Runs Java (Compiler Explorer, or self-hosted Piston via PISTON_URL).
// Auth required — this must not be a public compute
// endpoint once the app is hosted. `wrap` splices the student's code into the
// beginner input() template (see lib/java/piston.ts).
export async function POST(req: Request) {
  const me = await currentUser();
  if (!me) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  if (!rateLimit(`run:${me.id}`, 10, 60 * 1000)) {
    return NextResponse.json({ compiled: false, stdout: "", error: "Slow down — max 10 runs per minute." });
  }

  const { code, stdin, wrap, lessonCode } = await req.json();
  if (typeof code !== "string") return NextResponse.json({ error: "code required" }, { status: 400 });
  const result = await runJava(code, stdin || "", { wrapBeginner: wrap !== false });
  // Analytics substrate (best-effort): did their code compile/run?
  logEvent({ type: EVENT.CODE_RUN, userId: me.id, classId: me.classId, lessonCode: lessonCode ?? null, compiled: (result as any)?.compiled ?? null });
  return NextResponse.json(result);
}
