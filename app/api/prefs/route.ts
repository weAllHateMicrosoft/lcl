import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth";
import { getSetting, setSetting } from "@/lib/settings";

// Per-staff preferences (stored in the Setting table as prefs:<userId>).
// Currently: askTeacher — whether students see "Ask <teacher>" when they
// highlight lesson text. Extend with more keys as needed.
export async function POST(req: Request) {
  const me = await requireRoleApi("TEACHER", "ADMIN");
  if (me instanceof NextResponse) return me;
  const body = await req.json();
  const current = await getSetting<Record<string, unknown>>(`prefs:${me.id}`, {});
  await setSetting(`prefs:${me.id}`, { ...current, ...(typeof body.askTeacher === "boolean" ? { askTeacher: body.askTeacher } : {}) });
  return NextResponse.json({ ok: true });
}
