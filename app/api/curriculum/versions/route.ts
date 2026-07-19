import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRoleApi } from "@/lib/auth";

// Version history for one lesson (newest first).
export async function GET(req: Request) {
  const gate = await requireRoleApi("ADMIN");
  if (gate instanceof NextResponse) return gate;

  const lessonId = new URL(req.url).searchParams.get("lessonId");
  if (!lessonId) return NextResponse.json({ error: "lessonId required" }, { status: 400 });

  const versions = await prisma.lessonVersion.findMany({
    where: { lessonId },
    orderBy: { publishedAt: "desc" },
    take: 30,
  });
  return NextResponse.json({
    versions: versions.map((v) => ({
      id: v.id,
      publishedAt: v.publishedAt,
      title: (v.snapshot as any)?.title ?? "",
      blockCount: ((v.snapshot as any)?.blocks || []).length,
    })),
  });
}
