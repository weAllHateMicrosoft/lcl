import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "./db";
import type { User } from "@prisma/client";
import type { Role } from "./roles";

// Real auth (replaces the dev role-switcher):
// - Staff (ADMIN/TEACHER): email + password (scrypt-hashed).
// - Students: join a Class via join code + display name — no credentials.
// - Session: stateless HMAC-signed cookie "userId:expiresMs:sig". No deps.

const COOKIE = "classos_session";
const SESSION_DAYS = 30;

// Sessions are only as strong as this key. Refuse to run in production with
// the dev default or a flimsy value — a known key means forgeable admin sessions.
export function assertStrongKey() {
  const raw = process.env.ENCRYPTION_KEY || "";
  if (process.env.NODE_ENV === "production" && (raw.length < 24 || raw.includes("dev-only"))) {
    throw new Error("Refusing to run: set a strong ENCRYPTION_KEY (32+ random chars) — see DEPLOY.md step 1.");
  }
}

function sessionKey(): Buffer {
  assertStrongKey();
  return crypto.createHash("sha256").update(`${process.env.ENCRYPTION_KEY || ""}:session`).digest();
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", sessionKey()).update(payload).digest("hex");
}

// ─── Passwords (scrypt, built into Node) ─────────────────────────────────────

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

// ─── Sessions ────────────────────────────────────────────────────────────────

export async function startSession(userId: string) {
  const expires = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = `${userId}:${expires}`;
  const jar = await cookies();
  jar.set(COOKIE, `${payload}:${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expires),
    secure: process.env.NODE_ENV === "production",
  });
}

export async function endSession() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return null;
  const parts = raw.split(":");
  if (parts.length !== 3) return null;
  const [userId, expires, sig] = parts;
  const payload = `${userId}:${expires}`;
  const expectedSig = sign(payload);
  if (sig.length !== expectedSig.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
  if (Number(expires) < Date.now()) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}

// ─── Guards ──────────────────────────────────────────────────────────────────

// For API routes: returns the user, or a ready-to-return 401/403 response.
export async function requireRoleApi(...roles: Role[]): Promise<User | NextResponse> {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "not signed in" }, { status: 401 });
  if (!roles.includes(u.role as Role)) return NextResponse.json({ error: `requires ${roles.join(" or ")}` }, { status: 403 });
  return u;
}

// ─── Join codes ──────────────────────────────────────────────────────────────

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L

export function makeJoinCode(len = 6): string {
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return out;
}
