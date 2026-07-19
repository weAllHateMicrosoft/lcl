import "server-only";
import crypto from "node:crypto";
import { prisma } from "./db";
import type { Feature, Provider } from "./llm/types";
import { OPENAI_COMPAT_BASE } from "./llm/providers";

// ─── Encryption for API keys at rest ─────────────────────────────────────────
// AES-256-GCM with a server-only master key. Keys are decrypted only here, on
// the server, and never sent to the client.

function masterKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY || "";
  // derive a stable 32-byte key from whatever the operator provided
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptSecret(plain: string): string {
  if (!plain) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSecret(blob: string): string {
  if (!blob || !blob.includes(":")) return "";
  try {
    const [ivH, tagH, dataH] = blob.split(":");
    const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(ivH, "hex"));
    decipher.setAuthTag(Buffer.from(tagH, "hex"));
    return Buffer.concat([decipher.update(Buffer.from(dataH, "hex")), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

// ─── Generic settings store ──────────────────────────────────────────────────

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await prisma.setting.upsert({
    where: { key },
    create: { key, value: value as any },
    update: { value: value as any },
  });
}

// ─── LLM provider config ─────────────────────────────────────────────────────

export interface StoredLLMConfig {
  provider: Provider;
  encryptedKey: string; // never exposed to the client
  model: string;
  models: Partial<Record<Feature, string>>; // per-feature overrides
  fallbacks: { provider: Provider; encryptedKey: string; model: string }[];
}

export interface ResolvedProviderConfig {
  provider: Provider;
  apiKey: string;
  model: string;
  baseUrl?: string;
  models: Partial<Record<Feature, string>>;
  fallbacks: { provider: Provider; apiKey: string; model: string; baseUrl?: string }[];
}

const DEFAULT_CONFIG: StoredLLMConfig = {
  provider: "stub",
  encryptedKey: "",
  model: "stub",
  models: {},
  fallbacks: [],
};

export async function getStoredLLMConfig(): Promise<StoredLLMConfig> {
  return getSetting<StoredLLMConfig>("llm", DEFAULT_CONFIG);
}

// Server-side: decrypts keys and attaches base URLs. Do not send to the client.
export async function getProviderConfig(): Promise<ResolvedProviderConfig> {
  const c = await getStoredLLMConfig();
  return {
    provider: c.provider,
    apiKey: decryptSecret(c.encryptedKey),
    model: c.model,
    baseUrl: OPENAI_COMPAT_BASE[c.provider],
    models: c.models || {},
    fallbacks: (c.fallbacks || []).map((f) => ({
      provider: f.provider,
      apiKey: decryptSecret(f.encryptedKey),
      model: f.model,
      baseUrl: OPENAI_COMPAT_BASE[f.provider],
    })),
  };
}

// Client-safe view: booleans instead of keys.
export async function getLLMConfigForClient() {
  const c = await getStoredLLMConfig();
  return {
    provider: c.provider,
    model: c.model,
    models: c.models || {},
    hasKey: Boolean(c.encryptedKey),
    fallbacks: (c.fallbacks || []).map((f) => ({ provider: f.provider, model: f.model, hasKey: Boolean(f.encryptedKey) })),
  };
}
