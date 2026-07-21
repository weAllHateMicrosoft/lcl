import { NextResponse } from "next/server";
import { requireRoleApi } from "@/lib/auth";
import { callProvider, OPENAI_COMPAT_BASE } from "@/lib/llm/providers";
import { getProviderConfig } from "@/lib/settings";
import type { Provider } from "@/lib/llm/types";

// One-token ping to confirm a key + model work. Test a NEW key (provider+apiKey
// +model) or an already-saved one by id.
export async function POST(req: Request) {
  const gate = await requireRoleApi("ADMIN");
  if (gate instanceof NextResponse) return gate;
  const body = await req.json();

  let provider = body.provider as Provider;
  let apiKey = body.apiKey as string;
  let model = body.model as string;
  let region = body.region as string | undefined;

  if (!apiKey && body.id) {
    const saved = (await getProviderConfig()).keys.find((k) => k.id === body.id);
    if (saved) {
      provider = saved.provider;
      apiKey = saved.apiKey;
      model = model || saved.model;
      region = region || saved.region;
    }
  }
  if (!provider || provider === "stub") return NextResponse.json({ ok: true, message: "Offline stub — no key needed." });
  if (!apiKey) return NextResponse.json({ ok: false, message: provider === "vertex" ? "No service-account JSON to test." : "No key to test." });

  try {
    const raw = await callProvider(
      { provider, apiKey, model, baseUrl: OPENAI_COMPAT_BASE[provider], region },
      { feature: "tutor", system: "Reply with the single word: ok", messages: [{ role: "user", content: "ping" }], maxTokens: 5 }
    );
    return NextResponse.json({ ok: true, message: `Reached ${provider}/${model}. Reply: "${raw.text.slice(0, 40)}"` });
  } catch (e) {
    return NextResponse.json({ ok: false, message: (e as Error).message.slice(0, 200) });
  }
}
