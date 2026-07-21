import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";

export default async function GradebookPage() {
  const me = await currentUser();
  if (!me) redirect("/join");
  // Teachers use each class's Gradebook tab now.
  if (me.role !== "STUDENT") redirect("/class");

  // ─── Student: my grades (released tests + mastered lessons) ───
  if (me.role === "STUDENT") {
    const [subs, progress, lessons] = await Promise.all([
      prisma.testSubmission.findMany({ where: { userId: me.id }, include: { test: true }, orderBy: { submittedAt: "desc" } }),
      prisma.progress.findMany({ where: { userId: me.id } }),
      prisma.lesson.findMany({ orderBy: [{ chapter: { order: "asc" } }, { order: "asc" }] }),
    ]);
    const mastered = new Set(progress.filter((p) => p.status === "MASTERED").map((p) => p.lessonId));
    return (
      <div className="main">
        <div className="crumb">MY GRADES</div>
        <h1 className="title" style={{ marginBottom: 16 }}>My grades</h1>

        <h2 style={{ fontFamily: "var(--serif)", fontSize: 18, margin: "0 0 8px" }}>Tests</h2>
        {subs.length === 0 && <p style={{ color: "var(--muted)" }}>No tests taken yet.</p>}
        {subs.map((s) => (
          <div className="panel" key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px" }}>
            <b>{s.test.title}</b>
            <span style={{ flex: 1 }} />
            {s.test.resultsReleased && s.status === "graded" ? (
              <Link className="btn ghost" href={`/tests/${s.testId}/result`} style={{ textDecoration: "none" }}>
                {s.finalScore}/{s.maxScore} · view
              </Link>
            ) : (
              <span style={{ color: "var(--muted)" }}>{s.test.resultsReleased ? "awaiting marks" : "not released"}</span>
            )}
          </div>
        ))}

        <h2 style={{ fontFamily: "var(--serif)", fontSize: 18, margin: "24px 0 8px" }}>Mastered lessons — {mastered.size}/{lessons.length}</h2>
        <div className="panel">
          {lessons.map((l) => (
            <span key={l.id} className={`cellpill ${mastered.has(l.id) ? "m" : "n"}`} style={{ margin: "3px 6px 3px 0", display: "inline-block" }}>
              {mastered.has(l.id) ? "●" : "○"} {l.code}
            </span>
          ))}
        </div>
      </div>
    );
  }

  // ─── Teacher/admin: class gradebook ───
  const classes = await prisma.class.findMany({
    where: me.role === "ADMIN" ? {} : { teacherId: me.id },
    include: { students: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  const classIds = classes.map((c) => c.id);
  const studentIds = classes.flatMap((c) => c.students.map((s) => s.id));
  const [tests, subs, progress] = await Promise.all([
    prisma.test.findMany({ where: { classId: { in: classIds } }, orderBy: { createdAt: "asc" } }),
    prisma.testSubmission.findMany({ where: { userId: { in: studentIds } } }),
    prisma.progress.findMany({ where: { userId: { in: studentIds }, status: "MASTERED" } }),
  ]);
  const subKey = (u: string, t: string) => `${u}:${t}`;
  const subMap = new Map(subs.map((s) => [subKey(s.userId, s.testId), s]));
  const masteredCount = new Map<string, number>();
  for (const p of progress) masteredCount.set(p.userId, (masteredCount.get(p.userId) || 0) + 1);

  return (
    <div className="main" style={{ maxWidth: 1100 }}>
      <div className="crumb">GRADEBOOK</div>
      <h1 className="title" style={{ marginBottom: 16 }}>Gradebook</h1>
      {classes.length === 0 && <p style={{ color: "var(--muted)" }}>No classes yet.</p>}

      {classes.map((c) => {
        const classTests = tests.filter((t) => t.classId === c.id);
        return (
          <div key={c.id} style={{ marginBottom: 30 }}>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: 18, margin: "0 0 8px" }}>{c.name}</h2>
            <div className="dashgrid">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Mastered</th>
                    {classTests.map((t) => (
                      <th key={t.id} title={t.title}>
                        <Link href={`/teacher/test/${t.id}`} style={{ color: "inherit" }}>{t.title.slice(0, 16)}</Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {c.students.map((s) => (
                    <tr key={s.id}>
                      <td className="name"><Link href={`/teacher/student/${s.id}`} style={{ textDecoration: "underline dotted var(--muted)" }}>{s.name}</Link></td>
                      <td>{masteredCount.get(s.id) || 0}</td>
                      {classTests.map((t) => {
                        const sub = subMap.get(subKey(s.id, t.id));
                        return (
                          <td key={t.id}>
                            {!sub ? <span style={{ color: "var(--muted)" }}>—</span> : sub.status === "graded" ? <b>{sub.finalScore}/{sub.maxScore}</b> : <span className="statuschip draft">to mark</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {c.students.length === 0 && <tr><td colSpan={2 + classTests.length} style={{ color: "var(--muted)" }}>No students yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
