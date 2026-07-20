import "server-only";
import crypto from "node:crypto";

// RFC 6238 TOTP, compatible with Google Authenticator. No dependencies.

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function generateTotpSecret(): string {
  const bytes = crypto.randomBytes(20);
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

function b32decode(s: string): Buffer {
  let bits = "";
  for (const c of s.toUpperCase().replace(/[^A-Z2-7]/g, "")) {
    bits += B32.indexOf(c).toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function hotp(secret: string, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac("sha1", b32decode(secret)).update(buf).digest();
  const off = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac.readUInt32BE(off) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
  return code;
}

// Accept the current 30s window ± 1 (clock drift).
export function verifyTotp(secret: string, code: string): boolean {
  const clean = String(code || "").replace(/\D/g, "");
  if (clean.length !== 6 || !secret) return false;
  const counter = Math.floor(Date.now() / 30_000);
  for (const c of [counter, counter - 1, counter + 1]) {
    const expect = hotp(secret, c);
    if (expect.length === clean.length && crypto.timingSafeEqual(Buffer.from(expect), Buffer.from(clean))) return true;
  }
  return false;
}

export function otpauthUri(accountLabel: string, secret: string): string {
  return `otpauth://totp/${encodeURIComponent("classOS")}:${encodeURIComponent(accountLabel)}?secret=${secret}&issuer=classOS&digits=6&period=30`;
}
