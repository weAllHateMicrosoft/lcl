import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth";
import { saveLLMConfig } from "@/lib/settings";
import { saveSmtpConfig, sendMail } from "@/lib/email";

// Save settings (admin only): LLM config (keys/models/prompts) and/or SMTP.
export async function POST(req: Request) {
  const gate = await requireRoleApi("ADMIN");
  if (gate instanceof NextResponse) return gate;
  const body = await req.json();

  if (body.smtp) {
    await saveSmtpConfig(body.smtp);
    if (body.smtp.testTo) {
      try {
        await sendMail(body.smtp.testTo, "classOS email test", "It works! Email verification and password resets are now active.");
        return NextResponse.json({ ok: true, message: `Test email sent to ${body.smtp.testTo} ✓` });
      } catch (e) {
        return NextResponse.json({ ok: false, message: `Saved, but sending failed: ${(e as Error).message.slice(0, 160)}` });
      }
    }
    if (!body.keys) return NextResponse.json({ ok: true });
  }

  await saveLLMConfig({ keys: body.keys || [], models: body.models || {}, prompts: body.prompts || {} });
  return NextResponse.json({ ok: true });
}
