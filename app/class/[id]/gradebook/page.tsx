import Link from "next/link";
import { authClass } from "@/lib/classauth";
import { prisma } from "@/lib/db";

export default async function GradebookTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await authClass(id);

  const [students, tests, lessons] = await Promise.all([
    prisma.user.findMany({ where: { classId: id, role: "STUDENT" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.test.findMany({ where: { classId: id }, orderBy: { createdAt: "asc" } }),
    prisma.lesson.findMany({ orderBy: [{ chapter: { order: "asc" } }, { order: "asc" }], select: { id: true, code: true, title: true } }),
  ]);
  const ids = students.map((s) => s.id);
  const [subs, progress] = await Promise.all([
    prisma.testSubmission.findMany({ where: { userId: { in: ids } } }),
    prisma.progress.findMany({ where: { userId: { in: ids } } }),
  ]);
  const subKey = (u: string, t: string) => `${u}:${t}`;
  const subMap = new Map(subs.map((s) => [subKey(s.userId, s.testId), s]));
  const pmap = new Map(progress.map((p) => [subKey(p.userId, p.lessonId), p]));
  const masteredCount = new Map<string, number>();
  for (const p of progress) if (p.status === "MASTERED") masteredCount.set(p.userId, (masteredCount.get(p.userId) || 0) + 1);
  const cls = (s?: string) => (s === "MASTERED" ? "m" : s === "IN_PROGRESS" ? "p" : "n");

  return (
    <>
    <h2 style={{ fontFamily: "var(--serif)", fontSize: 18, margin: "0 0 8px" }}>Test scores</h2>
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

    <h2 style={{ fontFamily: "var(--serif)", fontSize: 18, margin: "24px 0 8px" }}>Lesson mastery</h2>
    <div className="dashgrid">
      <table>
        <thead>
          <tr>
            <th>Student</th>
            {lessons.map((l) => <th key={l.id} title={l.title}>{l.code}</th>)}
          </tr>
        </thead>
        <tbody>
          {students.map((s) => (
            <tr key={s.id}>
              <td className="name"><Link href={`/teacher/student/${s.id}`} style={{ textDecoration: "underline dotted var(--muted)" }}>{s.name}</Link></td>
              {lessons.map((l) => {
                const p = pmap.get(subKey(s.id, l.id));
                return (
                  <td key={l.id} title={p?.status || "NOT STARTED"}>
                    <span className={`cellpill ${cls(p?.status)}`}>{p?.status === "MASTERED" ? "●" : p?.status === "IN_PROGRESS" ? "◐" : "○"}</span>
                    {p?.flag && <span className={`flag ${p.flag === "coast" ? "coast" : ""}`}>{p.flag === "stuck" ? "STUCK" : "EXTEND"}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
          {students.length === 0 && <tr><td colSpan={1 + lessons.length} style={{ color: "var(--muted)" }}>No students yet.</td></tr>}
        </tbody>
      </table>
    </div>
    </>
  );
}
