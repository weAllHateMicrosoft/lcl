import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { encryptSecret, getStoredLLMConfig, setSetting, type StoredLLMConfig } from "@/lib/settings";
import type { Feature, Provider } from "@/lib/llm/types";

// Save LLM provider config. Keys are encrypted here and never returned to the
// client. A blank key field means "keep the existing key".
export async function POST(req: Request) {
  await requireRole("ADMIN");
  const body = await req.json();
  const existing = await getStoredLLMConfig();

  const models: Partial<Record<Feature, string>> = {};
  for (const f of ["tutor", "grade", "generate", "runjava"] as Feature[]) {
    if (body.models?.[f]) models[f] = body.models[f];
  }

  const next: StoredLLMConfig = {
    provider: (body.provider as Provider) || "stub",
    model: body.model || "stub",
    encryptedKey: body.apiKey ? encryptSecret(body.apiKey) : existing.encryptedKey,
    models,
    fallbacks:
      body.fallback?.provider && body.fallback.provider !== "none"
        ? [
            {
              provider: body.fallback.provider as Provider,
              model: body.fallback.model || "",
              encryptedKey: body.fallback.apiKey ? encryptSecret(body.fallback.apiKey) : existing.fallbacks?.[0]?.encryptedKey || "",
            },
          ]
        : [],
  };

  await setSetting("llm", next);
  return NextResponse.json({ ok: true });
}
