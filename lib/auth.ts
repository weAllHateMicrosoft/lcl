import "server-only";
import { cookies } from "next/headers";
import { prisma } from "./db";
import type { User } from "@prisma/client";
import type { Role } from "./roles";

// ──────────────────────────────────────────────────────────────────────────────
// DEV AUTH SHIM.
//
// This is a stand-in so the app runs and demonstrates roles without an auth
// provider. It trusts a cookie naming the current user — fine for a local
// prototype, NOT for production.
//
// TO MATURE: replace this file's internals with Auth.js (NextAuth). Keep the
// same exported functions (`currentUser`, `requireRole`) and every caller keeps
// working — this is the seam.
// ──────────────────────────────────────────────────────────────────────────────

const COOKIE = "classos_uid";

export async function currentUser(): Promise<User> {
  const jar = await cookies();
  const uid = jar.get(COOKIE)?.value;

  if (uid) {
    const u = await prisma.user.findUnique({ where: { id: uid } });
    if (u) return u;
  }
  // default to the seeded demo student
  const fallback = await prisma.user.findFirst({ where: { role: "STUDENT" }, orderBy: { createdAt: "asc" } });
  if (!fallback) throw new Error("No users seeded. Run `npm run db:seed`.");
  return fallback;
}

export async function setCurrentUser(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE, userId, { httpOnly: true, sameSite: "lax", path: "/" });
}

export async function requireRole(...roles: Role[]): Promise<User> {
  const u = await currentUser();
  if (!roles.includes(u.role as Role)) throw new Error(`Forbidden: needs ${roles.join(" or ")}`);
  return u;
}

// Non-throwing guard for pages: lets them render a friendly notice instead of a
// crash when you're "acting as" the wrong role.
export async function canRole(...roles: Role[]): Promise<boolean> {
  const u = await currentUser();
  return roles.includes(u.role as Role);
}
