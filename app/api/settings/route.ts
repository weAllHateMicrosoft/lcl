import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth";
import { saveLLMConfig } from "@/lib/settings";

// Save the whole LLM config: keys (rotation lanes), per-task models, prompts.
// Admin only. Keys are encrypted in saveLLMConfig; a blank key row keeps the
// existing key (matched by id).
export async function POST(req: Request) {
  const gate = await requireRoleApi("ADMIN");
  if (gate instanceof NextResponse) return gate;
  const body = await req.json();
  await saveLLMConfig({ keys: body.keys || [], models: body.models || {}, prompts: body.prompts || {} });
  return NextResponse.json({ ok: true });
}
