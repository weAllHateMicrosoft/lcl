import "server-only";
import nodemailer from "nodemailer";
import { prisma } from "./db";
import { getSetting, setSetting, encryptSecret, decryptSecret } from "./settings";

// Email sending via the admin's own SMTP (typically Gmail + App Password —
// free, no card). Config lives in Settings (encrypted), not env, so it's
// editable in-app. If unconfigured, callers fall back gracefully.

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  encryptedPass: string;
}

export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  const c = await getSetting<SmtpConfig | null>("smtp", null);
  return c && c.host && c.user && c.encryptedPass ? c : null;
}

export async function saveSmtpConfig(input: { host: string; port: number; user: string; pass?: string }) {
  const existing = await getSetting<SmtpConfig | null>("smtp", null);
  await setSetting("smtp", {
    host: input.host || "smtp.gmail.com",
    port: Number(input.port) || 465,
    user: input.user,
    encryptedPass: input.pass ? encryptSecret(input.pass) : existing?.encryptedPass || "",
  });
}

export async function isEmailConfigured(): Promise<boolean> {
  return (await getSmtpConfig()) !== null;
}

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  const cfg = await getSmtpConfig();
  if (!cfg) throw new Error("email not configured");
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.port === 465,
    auth: { user: cfg.user, pass: decryptSecret(cfg.encryptedPass) },
  });
  await transporter.sendMail({ from: `"classOS" <${cfg.user}>`, to, subject, text });
}

// ─── Verification codes ──────────────────────────────────────────────────────

export function sixDigits(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function issueCode(email: string, purpose: string, payload?: unknown): Promise<string> {
  const code = sixDigits();
  await prisma.authCode.deleteMany({ where: { email, purpose } }); // one active code per purpose
  await prisma.authCode.create({
    data: { email, purpose, code, payload: (payload ?? null) as any, expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
  });
  return code;
}

export async function consumeCode(email: string, purpose: string, code: string): Promise<{ ok: boolean; payload?: any }> {
  const row = await prisma.authCode.findFirst({ where: { email, purpose }, orderBy: { createdAt: "desc" } });
  if (!row || row.expiresAt < new Date() || row.code !== String(code || "").trim()) return { ok: false };
  await prisma.authCode.delete({ where: { id: row.id } });
  return { ok: true, payload: row.payload };
}
