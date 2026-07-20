import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { generateTotpSecret, verifyTotp, otpauthUri } from "@/lib/totp";
import { encryptSecret, decryptSecret } from "@/lib/settings";

// Google Authenticator enrollment for staff.
// GET → a fresh secret + otpauth:// URI (shown once; user adds it to the app)
// POST {secret, code} → verify the first code, then save (encrypted)
// POST {disable: true, code} → turn 2FA off (requires a current code)
export async function GET() {
  const me = await currentUser();
  if (!me || me.role === "STUDENT") return NextResponse.json({ error: "staff only" }, { status: 403 });
  const secret = generateTotpSecret();
  return NextResponse.json({ secret, uri: otpauthUri(me.email || me.name, secret), enabled: Boolean(me.totpSecret) });
}

export async function POST(req: Request) {
  const me = await currentUser();
  if (!me || me.role === "STUDENT") return NextResponse.json({ error: "staff only" }, { status: 403 });
  const { secret, code, disable } = await req.json();

  if (disable) {
    if (!me.totpSecret || !verifyTotp(decryptSecret(me.totpSecret), code)) {
      return NextResponse.json({ error: "Wrong authenticator code." }, { status: 401 });
    }
    await prisma.user.update({ where: { id: me.id }, data: { totpSecret: null } });
    return NextResponse.json({ ok: true, enabled: false });
  }

  if (!secret || !verifyTotp(secret, code)) {
    return NextResponse.json({ error: "That code doesn't match — check the app and try again." }, { status: 400 });
  }
  await prisma.user.update({ where: { id: me.id }, data: { totpSecret: encryptSecret(secret) } });
  return NextResponse.json({ ok: true, enabled: true });
}
