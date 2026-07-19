import type { CompleteArgs, Lane } from "./types";

// A raw provider call returns text + token usage; the adapter handles JSON
// parsing, cost, and fallback on top of this.
export interface RawResult {
  text: string;
  input: number;
  output: number;
}

// Default OpenAI-compatible base URLs. Groq, Gemini (compat endpoint), and
// OpenRouter all speak /v1/chat/completions — so we write this ONE client and
// treat them as base-URL + model + key swaps.
export const OPENAI_COMPAT_BASE: Record<string, string> = {
  groq: "https://api.groq.com/openai/v1",
  openrouter: "https://openrouter.ai/api/v1",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai",
};

export async function callProvider(lane: Lane, args: CompleteArgs): Promise<RawResult> {
  switch (lane.provider) {
    case "stub":
      return callStub(args);
    case "anthropic":
      return callAnthropic(lane, args);
    default:
      return callOpenAICompat(lane, args);
  }
}

// ─── OpenAI-compatible (Groq / OpenRouter / Gemini-compat) ───────────────────

async function callOpenAICompat(lane: Lane, args: CompleteArgs): Promise<RawResult> {
  const base = lane.baseUrl || OPENAI_COMPAT_BASE[lane.provider];
  if (!base) throw new Error(`no base URL for provider ${lane.provider}`);
  if (!lane.apiKey) throw new Error(`missing API key for ${lane.provider}`);

  const body: Record<string, unknown> = {
    model: lane.model,
    max_tokens: args.maxTokens ?? 1024,
    messages: [
      { role: "system", content: args.system },
      ...args.messages,
    ],
  };
  if (args.json) body.response_format = { type: "json_object" };

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${lane.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = new Error(`${lane.provider} ${res.status}: ${await res.text()}`);
    (err as any).status = res.status;
    throw err;
  }
  const data = await res.json();
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    input: data.usage?.prompt_tokens ?? 0,
    output: data.usage?.completion_tokens ?? 0,
  };
}

// ─── Anthropic (thin native path) ────────────────────────────────────────────

async function callAnthropic(lane: Lane, args: CompleteArgs): Promise<RawResult> {
  if (!lane.apiKey) throw new Error("missing Anthropic API key");
  const messages = [...args.messages];
  // Anthropic has no json_mode; prefill an opening brace to force JSON.
  if (args.json) messages.push({ role: "assistant", content: "{" });

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": lane.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: lane.model,
      max_tokens: args.maxTokens ?? 1024,
      system: args.system,
      messages,
    }),
  });
  if (!res.ok) {
    const err = new Error(`anthropic ${res.status}: ${await res.text()}`);
    (err as any).status = res.status;
    throw err;
  }
  const data = await res.json();
  let text = (data.content ?? [])
    .filter((b: any) => b.type === "text")
    .map((b: any) => b.text)
    .join("");
  if (args.json) text = "{" + text; // put back the prefilled brace
  return {
    text,
    input: data.usage?.input_tokens ?? 0,
    output: data.usage?.output_tokens ?? 0,
  };
}

// ─── Stub (offline default — the app runs with NO keys) ──────────────────────

function callStub(args: CompleteArgs): RawResult {
  let text: string;
  switch (args.feature) {
    case "tutor":
      text =
        "(offline tutor) Let's think about it together — what does your loop variable start at, what condition keeps it going, and what line moves it toward stopping? Add a real API key in Admin → Settings for live, personalized help.";
      break;
    case "grade":
      text = JSON.stringify({
        feedback:
          "(offline grading) Your output was compared to the expected result to decide pass/fail. Add an API key in Admin → Settings for detailed AI feedback on your logic.",
      });
      break;
    case "generate":
      // No key → the API route falls back to the lesson's own quizBank.
      text = JSON.stringify({ questions: [] });
      break;
    default:
      text = JSON.stringify({
        compiled: true,
        error: "",
        stdout: "(offline) real Java execution runs via the Piston API",
      });
  }
  // rough token estimate so cost tracking has something to show
  const input = Math.ceil((args.system.length + JSON.stringify(args.messages).length) / 4);
  return { text, input, output: Math.ceil(text.length / 4) };
}
