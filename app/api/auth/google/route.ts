import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { currentUser } from "@/lib/auth";
import { consentUrl, redirectUriFor } from "@/lib/google";

// Start the Google Classroom connect flow. Only a signed-in teacher/admin can
// connect (the callback attaches the tokens to whoever is signed in).
export async function GET(req: Request) {
  const me = await currentUser();
  if (!me || me.role === "STUDENT") return NextResponse.redirect(new URL("/login", req.url));

  // CSRF state: signed userId, checked in the callback.
  const raw = `${me.id}.${Date.now()}`;
  const sig = crypto.createHmac("sha256", (process.env.ENCRYPTION_KEY || "") + ":gstate").update(raw).digest("hex").slice(0, 32);
  const state = `${raw}.${sig}`;

  return NextResponse.redirect(consentUrl(redirectUriFor(req), state));
}
