import "server-only";
import { prisma } from "./db";
import { encryptSecret, decryptSecret } from "./settings";

// Google Classroom integration core. Everything Classroom-related goes through
// here so features (announcements, coursework, grades) are one-liners and token
// refresh is handled in exactly one place.

// Scopes for the planned features. classroom.coursework.students is the fix for
// the 403 — it lets a teacher create/manage coursework + grades in courses they
// teach (coursework.me was the student-facing scope, hence PERMISSION_DENIED).
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/classroom.courses.readonly", // list the teacher's courses
  "https://www.googleapis.com/auth/classroom.rosters.readonly", // match students
  "https://www.googleapis.com/auth/classroom.announcements", // post to the stream
  "https://www.googleapis.com/auth/classroom.coursework.students", // create assignments + push grades
];

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://classroom.googleapis.com/v1";

// redirect_uri must byte-match between the consent request, the token exchange,
// AND a URI registered in GCP. Deriving it from the request origin means both
// localhost and your Vercel domain work once both are registered.
export function redirectUriFor(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return process.env.GOOGLE_REDIRECT_URI_OVERRIDE || `${proto}://${host}/api/auth/google/callback`;
}

export function consentUrl(redirectUri: string, state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: redirectUri,
    access_type: "offline", // needed to receive a refresh_token
    response_type: "code",
    prompt: "consent", // force a refresh_token even on re-consent
    include_granted_scopes: "true",
    scope: GOOGLE_SCOPES.join(" "),
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

export async function exchangeCode(code: string, redirectUri: string): Promise<any> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  return res.json();
}

// Persist a teacher's connection (refresh token encrypted at rest).
export async function connectUserGoogle(userId: string, tokenData: any): Promise<{ ok: boolean; error?: string }> {
  if (!tokenData?.refresh_token) {
    // Happens if Google already granted consent and didn't re-issue one. The
    // fix is to revoke access + reconnect, or we always send prompt=consent.
    return { ok: false, error: "Google didn't return a refresh token — disconnect the app in your Google account and reconnect." };
  }
  let email: string | undefined;
  try {
    const r = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
    email = (await r.json()).email;
  } catch {}
  await prisma.user.update({ where: { id: userId }, data: { googleRefreshToken: encryptSecret(tokenData.refresh_token), googleEmail: email } });
  return { ok: true };
}

export async function disconnectUserGoogle(userId: string) {
  await prisma.user.update({ where: { id: userId }, data: { googleRefreshToken: null, googleEmail: null } });
}

export async function isGoogleConnected(userId: string): Promise<boolean> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { googleRefreshToken: true } });
  return Boolean(u?.googleRefreshToken);
}

// ─── Access-token cache + refresh ────────────────────────────────────────────

const cache = new Map<string, { token: string; exp: number }>();

async function getAccessToken(userId: string): Promise<string | null> {
  const c = cache.get(userId);
  if (c && c.exp > Date.now() + 30_000) return c.token;
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { googleRefreshToken: true } });
  if (!u?.googleRefreshToken) return null;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: decryptSecret(u.googleRefreshToken),
      client_id: process.env.GOOGLE_CLIENT_ID || "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
      grant_type: "refresh_token",
    }),
  });
  const d = await res.json();
  if (!d.access_token) return null;
  cache.set(userId, { token: d.access_token, exp: Date.now() + (d.expires_in || 3600) * 1000 });
  return d.access_token;
}

// The one function every Classroom call goes through. Auto-refreshes; retries
// once on 401. Returns { ok, status, data }.
export async function googleFetch(
  userId: string,
  path: string,
  init: RequestInit = {}
): Promise<{ ok: boolean; status: number; data: any }> {
  let token = await getAccessToken(userId);
  if (!token) return { ok: false, status: 401, data: { error: "not connected to Google" } };
  const url = path.startsWith("http") ? path : `${API}${path}`;
  const call = (t: string) => fetch(url, { ...init, headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json", ...(init.headers || {}) } });

  let res = await call(token);
  if (res.status === 401) {
    cache.delete(userId);
    token = await getAccessToken(userId);
    if (token) res = await call(token);
  }
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

// ─── Typed helpers (the "do anything" surface — extend freely) ───────────────

export const listCourses = (userId: string) => googleFetch(userId, "/courses?teacherId=me&courseStates=ACTIVE");
export const listStudents = (userId: string, courseId: string) => googleFetch(userId, `/courses/${courseId}/students`);
export const createAnnouncement = (userId: string, courseId: string, text: string) =>
  googleFetch(userId, `/courses/${courseId}/announcements`, { method: "POST", body: JSON.stringify({ text, state: "PUBLISHED" }) });
export const createCoursework = (userId: string, courseId: string, work: Record<string, unknown>) =>
  googleFetch(userId, `/courses/${courseId}/courseWork`, { method: "POST", body: JSON.stringify({ workType: "ASSIGNMENT", state: "PUBLISHED", ...work }) });
