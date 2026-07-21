import "server-only";
import { redirect, notFound } from "next/navigation";
import { prisma } from "./db";
import { currentUser } from "./auth";
import type { User } from "@prisma/client";

// Authorize access to a class workspace: must be signed-in staff, and (unless
// admin) the class's own teacher. Returns the current user + the class.
export async function authClass(id: string): Promise<{ me: User; cls: NonNullable<Awaited<ReturnType<typeof loadClass>>> }> {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "TEACHER" && me.role !== "ADMIN") notFound();
  const cls = await loadClass(id);
  if (!cls) notFound();
  if (me.role === "TEACHER" && cls.teacherId !== me.id) notFound();
  return { me, cls };
}

function loadClass(id: string) {
  return prisma.class.findUnique({ where: { id } });
}
