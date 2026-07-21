import { authClass } from "@/lib/classauth";
import { prisma } from "@/lib/db";
import AnnouncePanel from "@/components/teacher/class/AnnouncePanel";

export default async function StreamTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cls } = await authClass(id);

  const studentIds = (await prisma.user.findMany({ where: { classId: id, role: "STUDENT" }, select: { id: true } })).map((s) => s.id);
  const raw = await prisma.message.findMany({
    where: { kind: "announcement", toId: { in: studentIds } },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  // de-dupe the per-student copies of each announcement
  const seen = new Set<string>();
  const posts: { body: string; at: Date }[] = [];
  for (const m of raw) {
    const key = m.body + "|" + Math.floor(m.createdAt.getTime() / 60000);
    if (seen.has(key)) continue;
    seen.add(key);
    posts.push({ body: m.body, at: m.createdAt });
  }

  return <AnnouncePanel classId={id} googleLinked={Boolean(cls.googleCourseId)} posts={posts.slice(0, 20).map((p) => ({ body: p.body, at: p.at.toISOString() }))} />;
}
