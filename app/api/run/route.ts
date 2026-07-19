import { NextResponse } from "next/server";
import { runJava } from "@/lib/java/piston";

// Runs Java via Piston. `wrap` splices the student's code into the beginner
// input() template (see lib/java/piston.ts).
export async function POST(req: Request) {
  const { code, stdin, wrap } = await req.json();
  if (typeof code !== "string") return NextResponse.json({ error: "code required" }, { status: 400 });
  const result = await runJava(code, stdin || "", { wrapBeginner: wrap !== false });
  return NextResponse.json(result);
}
