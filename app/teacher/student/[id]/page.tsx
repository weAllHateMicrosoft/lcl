import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { stripHtml } from "@/lib/sanitize";
import Forbidden from "@/components/Forbidden";

// Per-student drill-down: every attempt, expandable to the exact questions
// missed (and the code they submitted). The evidence behind the pills.
export default async function StudentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "TEACHER" && me.role !== "ADMIN") return <Forbidden need="Teacher" />;

  const student = await prisma.user.findUnique({ where: { id }, include: { class: true } });
  if (!student || student.role !== "STUDENT") notFound();
  // Teachers can only open students from their own classes.
  if (me.role === "TEACHER" && student.class?.teacherId !== me.id) return <Forbidden need="Teacher" />;

  const [progress, attempts, testSubs] = await Promise.all([
    prisma.progress.findMany({ where: { userId: id } }),
    prisma.attempt.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 200, include: { lesson: true } }),
    prisma.testSubmission.findMany({ where: { userId: id }, include: { test: true }, orderBy: { submittedAt: "desc" } }),
  ]);
  const lessons = await prisma.lesson.findMany({ orderBy: [{ chapter: { order: "asc" } }, { order: "asc" }] });
  const pByLesson = new Map(progress.map((p) => [p.lessonId, p]));

  // Group attempts by lesson so the page isn't a wall of code-runs.
  type Att = (typeof attempts)[number];
  const byLesson = new Map<string, { lesson: Att["lesson"]; items: Att[] }>();
  for (const a of attempts) {
    if (!byLesson.has(a.lessonId)) byLesson.set(a.lessonId, { lesson: a.lesson, items: [] });
    byLesson.get(a.lessonId)!.items.push(a);
  }
  const groupsInOrder = lessons.map((l) => byLesson.get(l.id)).filter(Boolean) as { lesson: Att["lesson"]; items: Att[] }[];

  const KIND_LABEL: Record<string, string> = {
    QUIZ_PRACTICE: "Practice quiz",
    QUIZ_GENERATED: "AI-generated set",
    CODE_RUN: "Coding exercise",
    QUIZ_SUMMATIVE: "🔒 Clean quiz",
  };

  return (
    <div className="shell">
      <div className="dash">
        <div className="crumb">
          <Link href="/teacher" style={{ textDecoration: "underline dotted" }}>
            TEACHER
          </Link>{" "}
          · STUDENT RECORD
        </div>
        <h1 className="title">{student.name}</h1>
        <p style={{ color: "var(--muted)", marginBottom: 20 }}>
          {student.class?.name ?? "no class"} · joined {student.createdAt.toLocaleDateString()} · {attempts.length} logged attempts
        </p>

        {/* per-lesson standing */}
        <div className="dashgrid" style={{ marginBottom: 24 }}>
          <table>
            <thead>
              <tr>
                <th>Lesson</th>
                <th>Status</th>
                <th>Readiness</th>
                <th>Attempts</th>
              </tr>
            </thead>
            <tbody>
              {lessons
                .filter((l) => pByLesson.has(l.id))
                .map((l) => {
                  const p = pByLesson.get(l.id)!;
                  const n = attempts.filter((a) => a.lessonId === l.id).length;
                  const cls = p.status === "MASTERED" ? "m" : p.status === "IN_PROGRESS" ? "p" : "n";
                  return (
                    <tr key={l.id}>
                      <td className="name">
                        {l.code} {l.title}
                      </td>
                      <td>
                        <span className={`cellpill ${cls}`}>{p.status.replace("_", " ")}</span>
                        {p.flag && <span className={`flag ${p.flag === "coast" ? "coast" : ""}`}>{p.flag === "stuck" ? "STUCK" : "EXTEND"}</span>}
                      </td>
                      <td>
                        <div className="ready" style={{ margin: 0, maxWidth: 140 }}>
                          <div className="barwrap" style={{ height: 9 }}>
                            <div className="bar" style={{ width: `${Math.round(p.readiness * 100)}%` }} />
                          </div>
                        </div>
                      </td>
                      <td>{n}</td>
                    </tr>
                  );
                })}
              {progress.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ color: "var(--muted)" }}>
                    No activity yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Tests taken */}
        {testSubs.length > 0 && (
          <>
            <h2 style={{ fontFamily: "var(--serif)", fontSize: 20, margin: "0 0 10px" }}>Tests</h2>
            <div className="dashgrid" style={{ marginBottom: 24 }}>
              <table>
                <tbody>
                  {testSubs.map((s) => (
                    <tr key={s.id}>
                      <td className="name">{s.test.title}</td>
                      <td><span className={`statuschip ${s.status === "graded" ? "live" : "draft"}`}>{s.status === "graded" ? "GRADED" : "NEEDS MARKING"}</span></td>
                      <td>{s.finalScore ?? s.autoScore}/{s.maxScore}</td>
                      <td style={{ color: "var(--muted)", fontSize: 12 }}>{s.submittedAt.toLocaleString()}</td>
                      <td><Link className="btn ghost" style={{ padding: "4px 10px" }} href={`/teacher/test/${s.testId}`}>open</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Practice history grouped by lesson (code-runs collapsed so it isn't a wall) */}
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 20, margin: "0 0 10px" }}>Lesson activity</h2>
        {groupsInOrder.length === 0 && <p style={{ color: "var(--muted)" }}>Nothing logged yet.</p>}
        {groupsInOrder.map((g) => {
          const quizzes = g.items.filter((a) => a.kind !== "CODE_RUN");
          const runs = g.items.filter((a) => a.kind === "CODE_RUN");
          const runsPassed = runs.filter((a) => a.passed).length;
          return (
            <details className="histpanel" key={g.lesson.id}>
              <summary style={{ cursor: "pointer", fontWeight: 700 }}>
                {g.lesson.code} {g.lesson.title}
                <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 13 }}>
                  {"  "}— {quizzes.length} quiz attempt{quizzes.length === 1 ? "" : "s"}, {runs.length} code run{runs.length === 1 ? "" : "s"}
                  {runs.length > 0 ? ` (${runsPassed} passed)` : ""}
                </span>
              </summary>
              <div style={{ marginTop: 8 }}>
                {quizzes.map((a) => {
                  const d = a.detail as any;
                  const questions: { q: string; picked?: string; answer?: string; ok?: boolean }[] = d?.questions || [];
                  const missed = questions.filter((q) => !q.ok);
                  return (
                    <details key={a.id} style={{ padding: "6px 0", borderTop: "1px dashed var(--line)" }}>
                      <summary style={{ cursor: "pointer" }}>
                        <b>{KIND_LABEL[a.kind] ?? a.kind}</b> · <span className={`score ${a.passed ? "ok" : "bad"}`}>{Math.round(a.score * 100)}%</span>
                        {questions.length > 0 && <span style={{ color: "var(--muted)", fontSize: 12 }}> — {missed.length ? `${missed.length} missed` : "clean"}</span>}
                        <span style={{ color: "var(--muted)", fontSize: 11, fontFamily: "var(--mono)" }}> · {a.createdAt.toLocaleDateString()}</span>
                      </summary>
                      <div style={{ padding: "8px 0 4px" }}>
                        {questions.map((q, i) => (
                          <div key={i} className={`test ${q.ok ? "pass" : "fail"}`}>
                            <span className="mark">{q.ok ? "✓" : "✗"}</span>
                            <div>
                              <span>{stripHtml(q.q)}</span>
                              {!q.ok && <div style={{ marginTop: 4, fontSize: 12 }}>picked: <b>{stripHtml(q.picked ?? "—")}</b> · correct: <b>{stripHtml(q.answer ?? "—")}</b></div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })}
                {runs.length > 0 && (
                  <details style={{ padding: "6px 0", borderTop: "1px dashed var(--line)" }}>
                    <summary style={{ cursor: "pointer" }}>
                      <b>Coding exercise runs</b> <span style={{ color: "var(--muted)", fontSize: 12 }}>— {runs.length} total, {runsPassed} passed</span>
                    </summary>
                    <div style={{ padding: "8px 0 4px" }}>
                      {runs.slice(0, 12).map((a) => {
                        const d = a.detail as any;
                        return (
                          <div key={a.id} className={`test ${a.passed ? "pass" : "fail"}`}>
                            <span className="mark">{a.passed ? "✓" : "✗"}</span>
                            <div style={{ fontSize: 12 }}>
                              {a.createdAt.toLocaleString()} {d?.mode ? `· ${d.mode === "ai" ? "AI check" : "output test"}` : ""}
                            </div>
                          </div>
                        );
                      })}
                      {runs.length > 12 && <div className="meta">+ {runs.length - 12} older runs</div>}
                    </div>
                  </details>
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
