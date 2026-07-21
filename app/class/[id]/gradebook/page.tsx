import Link from "next/link";
import { authClass } from "@/lib/classauth";
import { prisma } from "@/lib/db";

export default async function GradebookTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await authClass(id);

  const [students, tests] = await Promise.all([
    prisma.user.findMany({ where: { classId: id, role: "STUDENT" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.test.findMany({ where: { classId: id }, orderBy: { createdAt: "asc" } }),
  ]);
  const ids = students.map((s) => s.id);
  const [subs, mastered] = await Promise.all([
    prisma.testSubmission.findMany({ where: { userId: { in: ids } } }),
    prisma.progress.groupBy({ by: ["userId"], where: { userId: { in: ids }, status: "MASTERED" }, _count: true }),
  ]);
  const subKey = (u: string, t: string) => `${u}:${t}`;
  const subMap = new Map(subs.map((s) => [subKey(s.userId, s.testId), s]));
  const masteredCount = new Map(mastered.map((m) => [m.userId, m._count]));

  return (
    <div className="dashgrid">
      <table>
        <thead>
          <tr>
            <th>Student</th>
            <th>Mastered</th>
            {tests.map((t) => (
              <th key={t.id} title={t.title}>
                <Link href={`/teacher/test/${t.id}`} style={{ color: "inherit" }}>{t.title.slice(0, 16)}</Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id}>
              <td className="name"><Link href={`/teacher/student/${s.id}`} style={{ textDecoration: "underline dotted var(--muted)" }}>{s.name}</Link></td>
              <td>{masteredCount.get(s.id) || 0}</td>
              {tests.map((t) => {
                const sub = subMap.get(subKey(s.id, t.id));
                return <td key={t.id}>{!sub ? <span style={{ color: "var(--muted)" }}>—</span> : sub.status === "graded" ? <b>{sub.finalScore}/{sub.maxScore}</b> : <span className="statuschip draft">to mark</span>}</td>;
              })}
            </tr>
          ))}
          {students.length === 0 && <tr><td colSpan={2 + tests.length} style={{ color: "var(--muted)" }}>No students yet.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
