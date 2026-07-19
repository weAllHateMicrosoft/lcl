import { prisma } from "@/lib/db";
import { canRole } from "@/lib/auth";
import Forbidden from "@/components/Forbidden";

export default async function TeacherDashboard() {
  if (!(await canRole("TEACHER", "ADMIN"))) return <Forbidden need="Teacher" />;

  const [students, lessons, progress, recent, aiAgg] = await Promise.all([
    prisma.user.findMany({ where: { role: "STUDENT" }, orderBy: { createdAt: "asc" } }),
    prisma.lesson.findMany({ orderBy: [{ chapter: { order: "asc" } }, { order: "asc" }] }),
    prisma.progress.findMany(),
    prisma.attempt.findMany({ orderBy: { createdAt: "desc" }, take: 15, include: { user: true, lesson: true } }),
    prisma.aiCall.aggregate({ _sum: { cost: true }, _count: true }),
  ]);

  const key = (u: string, l: string) => `${u}:${l}`;
  const pmap = new Map(progress.map((p) => [key(p.userId, p.lessonId), p]));

  return (
    <div className="main" style={{ maxWidth: 1100 }}>
      <h1>Teacher dashboard</h1>
      <p className="goal">Mastery is evidence-backed: only a passing clean quiz turns a cell green. Everything else feeds readiness &amp; flags.</p>

      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>Student</th>
              {lessons.map((l) => (
                <th key={l.id} title={l.title}>
                  {l.code}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                {lessons.map((l) => {
                  const p = pmap.get(key(s.id, l.id));
                  const status = p?.status || "NOT_STARTED";
                  return (
                    <td key={l.id}>
                      <span className={`cellpill ${status}`}>{status === "MASTERED" ? "●" : status === "IN_PROGRESS" ? "◐" : "○"}</span>
                      {p?.flag && <span className="flag">{p.flag === "stuck" ? "STUCK" : "EXTEND"}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="notice" style={{ marginTop: 22 }}>
        AI usage this environment: <b>{aiAgg._count}</b> calls · <b>${(aiAgg._sum.cost || 0).toFixed(5)}</b> total.
      </div>

      <h2 style={{ marginTop: 26, fontSize: 18 }}>Recent activity</h2>
      {recent.length === 0 ? (
        <p style={{ color: "var(--muted)" }}>No attempts yet — act as a student and try a lesson.</p>
      ) : (
        <table>
          <tbody>
            {recent.map((a) => (
              <tr key={a.id}>
                <td>{a.user.name}</td>
                <td>{a.lesson.code} {a.lesson.title}</td>
                <td style={{ fontFamily: "var(--mono)", fontSize: 11 }}>{a.kind}</td>
                <td>
                  <span className={`verdict ${a.passed ? "ok" : "bad"}`}>{a.passed ? "pass ✓" : "fail"}</span>
                </td>
                <td style={{ color: "var(--muted)", fontSize: 12 }}>{a.createdAt.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <p className="meta" style={{ marginTop: 20 }}>
        CSV export, per-student drawers, and Auth.js sign-in are on the roadmap (see README).
      </p>
    </div>
  );
}
