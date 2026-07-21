import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { studentConsentUrl, redirectUriFor } from "@/lib/google";

// Start "Sign in with Google" for a student. No login required (they're logging
// in). Reuses the existing OAuth callback, marked by a "student:" state.
export async function GET(req: Request) {
  const ts = Date.now();
  const sig = crypto.createHmac("sha256", (process.env.ENCRYPTION_KEY || "") + ":gstate").update(`student:${ts}`).digest("hex").slice(0, 32);
  const state = `student:${ts}:${sig}`;
  return NextResponse.redirect(studentConsentUrl(redirectUriFor(req), state));
}
