import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import { currentUser, startSession } from "@/lib/auth";
import { exchangeCode, connectUserGoogle, googleEmailOf, redirectUriFor } from "@/lib/google";

// Google redirects here after consent. Two modes, distinguished by `state`:
//   "student:…"  → student Sign-in with Google (find account by email, sign in)
//   "<uid>.…"    → teacher connecting Classroom (store encrypted refresh token)
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state") || "";
  const err = searchParams.get("error");

  const sign = (payload: string) => crypto.createHmac("sha256", (process.env.ENCRYPTION_KEY || "") + ":gstate").update(payload).digest("hex").slice(0, 32);

  // ─── Student sign-in ───
  if (state.startsWith("student:")) {
    const [, ts, sig] = state.split(":");
    if (err || !code) return NextResponse.redirect(`${origin}/login?google=denied`);
    if (sig !== sign(`student:${ts}`)) return NextResponse.redirect(`${origin}/login?google=badstate`);

    const tokenData = await exchangeCode(code, redirectUriFor(req));
    const email = tokenData.access_token ? await googleEmailOf(tokenData.access_token) : null;
    if (!email) return NextResponse.redirect(`${origin}/login?google=error`);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.redirect(`${origin}/login?google=nostudent`);
    // Signing in via Google proves email ownership → verify + activate.
    await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: user.emailVerifiedAt ?? new Date(), failedLogins: 0, lockedAt: null } });
    await startSession(user.id);
    return NextResponse.redirect(`${origin}${user.role === "STUDENT" ? "/lessons" : "/teacher"}`);
  }

  // ─── Teacher connecting Classroom ───
  const back = (q: string) => NextResponse.redirect(`${origin}/class?google=${q}`);
  if (err) return back("denied");
  if (!code) return back("nocode");
  const me = await currentUser();
  if (!me || me.role === "STUDENT") return NextResponse.redirect(`${origin}/login`);
  const [uid, ts, sig] = state.split(".");
  if (uid !== me.id || sig !== sign(`${uid}.${ts}`)) return back("badstate");
  try {
    const tokenData = await exchangeCode(code, redirectUriFor(req));
    if (tokenData.error) return back("exchange");
    const r = await connectUserGoogle(me.id, tokenData);
    return back(r.ok ? "connected" : "norefresh");
  } catch {
    return back("error");
  }
}
