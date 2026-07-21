import Link from "next/link";
import { authClass } from "@/lib/classauth";
import { prisma } from "@/lib/db";

export default async function ClassOverview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await authClass(id);

  const students = await prisma.user.findMany({ where: { classId: id, role: "STUDENT" }, select: { id: true, name: true } });
  const ids = students.map((s) => s.id);
  const [progress, recent, lessons] = await Promise.all([
    prisma.progress.findMany({ where: { userId: { in: ids } } }),
    prisma.attempt.findMany({ where: { userId: { in: ids } }, orderBy: { createdAt: "desc" }, take: 8, include: { user: true, lesson: true } }),
    prisma.lesson.findMany({ select: { id: true, code: true, title: true } }),
  ]);
  const lessonName = new Map(lessons.map((l) => [l.id, `${l.code} ${l.title}`]));
  const nameOf = new Map(students.map((s) => [s.id, s.name]));

  const stuck = progress.filter((p) => p.flag === "stuck");
  const coasting = progress.filter((p) => p.flag === "coast");
  const mastered = progress.filter((p) => p.status === "MASTERED").length;
  const pct = progress.length ? Math.round((mastered / progress.length) * 100) : 0;

  return (
    <>
      <div className="kpis">
        <div className="kpi"><div className="n"><em>{students.length}</em></div><p>students</p></div>
        <div className="kpi"><div className="n"><em>{stuck.length}</em></div><p>stuck (need help)</p></div>
        <div className="kpi"><div className="n"><em>{pct}%</em></div><p>of started topics mastered</p></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <div className="panel">
          <h2>Needs attention</h2>
          {stuck.length === 0 && coasting.length === 0 && <p style={{ color: "var(--muted)", fontSize: 14 }}>Nobody's flagged right now. 🎉</p>}
          {stuck.map((p) => (
            <div key={p.id} className="test fail" style={{ marginBottom: 6 }}>
              <span className="mark">STUCK</span>
              <div><Link href={`/teacher/student/${p.userId}`}>{nameOf.get(p.userId)}</Link> — {lessonName.get(p.lessonId)}</div>
            </div>
          ))}
          {coasting.map((p) => (
            <div key={p.id} className="test" style={{ marginBottom: 6, borderColor: "var(--violet)" }}>
              <span className="mark" style={{ color: "var(--violet)" }}>EXTEND</span>
              <div><Link href={`/teacher/student/${p.userId}`}>{nameOf.get(p.userId)}</Link> — coasting on {lessonName.get(p.lessonId)}</div>
            </div>
          ))}
        </div>

        <div className="panel">
          <h2>Recent activity</h2>
          {recent.length === 0 && <p style={{ color: "var(--muted)", fontSize: 14 }}>No activity yet.</p>}
          {recent.map((a) => (
            <div key={a.id} style={{ fontSize: 13, padding: "5px 0", borderBottom: "1px dashed var(--line)" }}>
              <b>{a.user.name}</b> · {a.lesson.code} · <span className={`score ${a.passed ? "ok" : "bad"}`}>{Math.round(a.score * 100)}%</span>
              <span style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 10 }}> · {a.createdAt.toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 4 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btn" href={`/class/${id}/stream`} style={{ textDecoration: "none" }}>📣 Post announcement</Link>
          <Link className="btn ghost" href={`/class/${id}/students`} style={{ textDecoration: "none" }}>Add / manage students</Link>
          <Link className="btn ghost" href={`/class/${id}/assignments`} style={{ textDecoration: "none" }}>Assign work</Link>
        </div>
      </div>
    </>
  );
}
