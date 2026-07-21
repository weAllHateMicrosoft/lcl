export type Feature = "tutor" | "grade" | "generate" | "runjava";

export type Provider = "stub" | "gemini" | "groq" | "openrouter" | "anthropic" | "vertex";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CompleteArgs {
  feature: Feature;
  system: string;
  messages: ChatMessage[];
  json?: boolean; // ask the provider for strict JSON and parse defensively
  maxTokens?: number;
}

export interface LLMResult<T = unknown> {
  text: string;
  data?: T; // populated when json:true and parsing succeeded
  usage: { input: number; output: number };
  cost: number; // normalized USD, from the DB price table
  provider: Provider;
  model: string;
}

// One lane = one attempt target. The adapter tries the primary, then fallbacks.
export interface Lane {
  provider: Provider;
  apiKey?: string; // for vertex, this is the service-account JSON
  model: string;
  baseUrl?: string; // for OpenAI-compatible providers
  region?: string; // vertex: GCP location, e.g. "us-central1" or "global"
}
