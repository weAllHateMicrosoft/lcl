import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { currentUser } from "@/lib/auth";
import { exchangeCode, connectUserGoogle, redirectUriFor } from "@/lib/google";

// Google redirects here after consent. We verify the state, exchange the code
// for tokens, and store the (encrypted) refresh token on the signed-in teacher.
export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state") || "";
  const err = searchParams.get("error");
  const back = (q: string) => NextResponse.redirect(`${origin}/teacher?google=${q}`);

  if (err) return back("denied");
  if (!code) return back("nocode");

  // verify state signature + that it matches the signed-in user
  const me = await currentUser();
  if (!me || me.role === "STUDENT") return NextResponse.redirect(`${origin}/login`);
  const [uid, ts, sig] = state.split(".");
  const expect = crypto.createHmac("sha256", (process.env.ENCRYPTION_KEY || "") + ":gstate").update(`${uid}.${ts}`).digest("hex").slice(0, 32);
  if (uid !== me.id || sig !== expect) return back("badstate");

  try {
    const tokenData = await exchangeCode(code, redirectUriFor(req));
    if (tokenData.error) return back("exchange");
    const r = await connectUserGoogle(me.id, tokenData);
    return back(r.ok ? "connected" : "norefresh");
  } catch {
    return back("error");
  }
}
