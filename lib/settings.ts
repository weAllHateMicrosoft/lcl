import "server-only";
import crypto from "node:crypto";
import { prisma } from "./db";
import type { Feature, Provider } from "./llm/types";
import { OPENAI_COMPAT_BASE } from "./llm/providers";

// ─── Encryption for API keys at rest (AES-256-GCM, server-only master key) ───

function masterKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || "";
  if (process.env.NODE_ENV === "production" && (raw.length < 24 || raw.includes("dev-only"))) {
    throw new Error("Refusing to run: set a strong ENCRYPTION_KEY (32+ random chars) — see DEPLOY.md step 1.");
  }
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSecret(blob: string): string {
  if (!blob || !blob.includes(":")) return "";
  try {
    const [ivH, tagH, dataH] = blob.split(":");
    const d = crypto.createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(ivH, "hex"));
    d.setAuthTag(Buffer.from(tagH, "hex"));
    return Buffer.concat([d.update(Buffer.from(dataH, "hex")), d.final()]).toString("utf8");
  } catch {
    return "";
  }
}

// ─── Generic settings store ───────────────────────────────────────────────

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row ? (row.value as T) : fallback;
}
export async function setSetting(key: string, value: unknown): Promise<void> {
  await prisma.setting.upsert({ where: { key }, create: { key, value: value as any }, update: { value: value as any } });
}

// ─── LLM config: a list of keys (rotation lanes) + per-feature model + prompts ─

export type PromptKey = "tutor" | "grade" | "generate";

export interface StoredKey {
  id: string;
  provider: Provider;
  encryptedKey: string;
  model: string;
  label?: string;
}
export interface StoredLLMConfig {
  keys: StoredKey[];
  models: Partial<Record<Feature, string>>; // per-task model override
  prompts: Partial<Record<PromptKey, string>>; // custom system-prompt templates
}

const rid = () => crypto.randomBytes(5).toString("hex");

export async function getStoredLLMConfig(): Promise<StoredLLMConfig> {
  const raw = await getSetting<any>("llm", null);
  if (raw && Array.isArray(raw.keys)) {
    return { keys: raw.keys, models: raw.models || {}, prompts: raw.prompts || {} };
  }
  // migrate the old single-key + fallbacks shape → keys[]
  const keys: StoredKey[] = [];
  if (raw?.provider && raw.provider !== "stub" && raw.encryptedKey) {
    keys.push({ id: rid(), provider: raw.provider, encryptedKey: raw.encryptedKey, model: raw.model || "", label: "primary" });
  }
  for (const f of raw?.fallbacks || []) {
    if (f.encryptedKey) keys.push({ id: rid(), provider: f.provider, encryptedKey: f.encryptedKey, model: f.model || "", label: "fallback" });
  }
  return { keys, models: raw?.models || {}, prompts: raw?.prompts || {} };
}

export interface ResolvedKey {
  id: string;
  provider: Provider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  label?: string;
}
export interface ResolvedConfig {
  keys: ResolvedKey[];
  models: Partial<Record<Feature, string>>;
  prompts: Partial<Record<PromptKey, string>>;
}

// Server-side: decrypts keys. Never send to the client.
export async function getProviderConfig(): Promise<ResolvedConfig> {
  const c = await getStoredLLMConfig();
  return {
    keys: c.keys.map((k) => ({ id: k.id, provider: k.provider, apiKey: decryptSecret(k.encryptedKey), model: k.model, baseUrl: OPENAI_COMPAT_BASE[k.provider], label: k.label })),
    models: c.models || {},
    prompts: c.prompts || {},
  };
}

// Client-safe view: booleans instead of keys.
export async function getLLMConfigForClient() {
  const c = await getStoredLLMConfig();
  return {
    keys: c.keys.map((k) => ({ id: k.id, provider: k.provider, model: k.model, label: k.label || "", hasKey: Boolean(k.encryptedKey) })),
    models: c.models || {},
    prompts: c.prompts || {},
  };
}

// Save from the admin UI. Each incoming key row carries either a new plaintext
// apiKey (encrypt it) or just an id (keep the existing encrypted key).
export async function saveLLMConfig(input: {
  keys: { id?: string; provider: Provider; model: string; label?: string; apiKey?: string }[];
  models: Partial<Record<Feature, string>>;
  prompts: Partial<Record<PromptKey, string>>;
}) {
  const existing = await getStoredLLMConfig();
  const byId = new Map(existing.keys.map((k) => [k.id, k]));
  const keys: StoredKey[] = [];
  for (const row of input.keys || []) {
    if (!row.provider || row.provider === "stub") continue;
    let encryptedKey = "";
    if (row.apiKey) encryptedKey = encryptSecret(row.apiKey);
    else if (row.id && byId.has(row.id)) encryptedKey = byId.get(row.id)!.encryptedKey;
    if (!encryptedKey) continue; // no key → drop the lane
    keys.push({ id: row.id && byId.has(row.id) ? row.id : rid(), provider: row.provider, model: row.model || "", label: row.label, encryptedKey });
  }
  const models: Partial<Record<Feature, string>> = {};
  for (const f of ["tutor", "grade", "generate", "runjava"] as Feature[]) if (input.models?.[f]) models[f] = input.models[f];
  const prompts: Partial<Record<PromptKey, string>> = {};
  for (const p of ["tutor", "grade", "generate"] as PromptKey[]) if (input.prompts?.[p]?.trim()) prompts[p] = input.prompts[p];

  await setSetting("llm", { keys, models, prompts });
}
