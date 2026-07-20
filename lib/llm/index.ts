import "server-only";
import type { CompleteArgs, Feature, Lane, LLMResult, Provider } from "./types";
import { callProvider } from "./providers";
import { safeParseJson } from "./json";
import { getProviderConfig } from "../settings";
import { prisma } from "../db";

// USD per 1M tokens [input, output]. Prices churn — mature this into a
// DB-editable table (Admin → Settings) so you never redeploy for a price change.
const PRICES: Record<string, [number, number]> = {
  stub: [0, 0],
  "gemini-2.0-flash": [0, 0], // free tier
  "gemini-1.5-flash": [0, 0],
  "llama-3.3-70b-versatile": [0, 0], // groq free
  "claude-haiku-4-5": [1, 5],
  "claude-sonnet-4-6": [3, 15],
  "claude-opus-4-8": [15, 75],
};

function costOf(model: string, input: number, output: number): number {
  const [pi, po] = PRICES[model] ?? [0, 0];
  return (input * pi + output * po) / 1e6;
}

function isRetryable(err: unknown): boolean {
  const status = (err as any)?.status;
  return status === 429 || (status >= 500 && status < 600) || status === undefined;
}

/**
 * The single chokepoint for every AI call. Resolves the configured lanes for a
 * feature, tries them in order (auto-failover on rate-limit / 5xx), parses JSON
 * defensively, normalizes cost, and logs the call for the teacher dashboard.
 */
export async function complete<T = unknown>(
  args: CompleteArgs,
  ctx?: { userId?: string }
): Promise<LLMResult<T>> {
  const lanes = await resolveLanes(args.feature);
  let lastErr: unknown;

  for (const lane of lanes) {
    try {
      const raw = await callProvider(lane, args);
      const data = args.json ? safeParseJson<T>(raw.text) : undefined;
      const cost = costOf(lane.model, raw.input, raw.output);

      // fire-and-forget usage log
      logCall(args.feature, lane, raw.input, raw.output, cost, ctx?.userId).catch(() => {});

      return {
        text: raw.text,
        data,
        usage: { input: raw.input, output: raw.output },
        cost,
        provider: lane.provider,
        model: lane.model,
      };
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err)) break; // auth/validation errors: don't waste other lanes
    }
  }
  throw lastErr ?? new Error("no LLM lanes configured");
}

// Build the ordered list of lanes to try for a feature: every configured key is
// a lane, tried in order and rotated on rate-limit/error (that's how multiple
// keys extend your daily quota). A per-feature model override applies to each.
// Always ends with the offline stub so the app never hard-fails.
async function resolveLanes(feature: Feature): Promise<Lane[]> {
  const cfg = await getProviderConfig();
  const lanes: Lane[] = [];
  for (const k of cfg.keys) {
    if (k.provider !== "stub" && k.apiKey) {
      lanes.push({ provider: k.provider, apiKey: k.apiKey, model: cfg.models[feature] || k.model, baseUrl: k.baseUrl });
    }
  }
  lanes.push({ provider: "stub" as Provider, model: "stub" });
  return lanes;
}

async function logCall(
  feature: Feature,
  lane: Lane,
  input: number,
  output: number,
  cost: number,
  userId?: string
) {
  await prisma.aiCall.create({
    data: { feature, provider: lane.provider, model: lane.model, inTokens: input, outTokens: output, cost, userId },
  });
}

export type { CompleteArgs, LLMResult, Feature } from "./types";
