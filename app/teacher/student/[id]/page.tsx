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

  const [progress, attempts] = await Promise.all([
    prisma.progress.findMany({ where: { userId: id } }),
    prisma.attempt.findMany({ where: { userId: id }, orderBy: { createdAt: "desc" }, take: 100, include: { lesson: true } }),
  ]);
  const lessons = await prisma.lesson.findMany({ orderBy: [{ chapter: { order: "asc" } }, { order: "asc" }] });
  const pByLesson = new Map(progress.map((p) => [p.lessonId, p]));

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

        {/* full timeline, expandable to question level */}
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 20, margin: "0 0 10px" }}>Every attempt — click one for the evidence</h2>
        <div className="dashgrid">
          <table>
            <tbody>
              {attempts.map((a) => {
                const d = a.detail as any;
                const questions: { q: string; picked?: string; answer?: string; ok?: boolean }[] = d?.questions || [];
                const missed = questions.filter((q) => !q.ok);
                return (
                  <tr key={a.id}>
                    <td style={{ verticalAlign: "top", whiteSpace: "nowrap", fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)" }}>
                      {a.createdAt.toLocaleString()}
                    </td>
                    <td style={{ verticalAlign: "top" }}>
                      <details>
                        <summary style={{ cursor: "pointer" }}>
                          <b>{KIND_LABEL[a.kind] ?? a.kind}</b> · {a.lesson.code} {a.lesson.title} ·{" "}
                          <span className={`score ${a.passed ? "ok" : "bad"}`}>
                            {Math.round(a.score * 100)}% {a.passed ? "✓" : "✗"}
                          </span>
                          {questions.length > 0 && (
                            <span style={{ color: "var(--muted)", fontSize: 12 }}>
                              {" "}
                              — {missed.length ? `${missed.length} missed` : "clean"}
                            </span>
                          )}
                        </summary>
                        <div style={{ padding: "10px 0 4px" }}>
                          {/* Attempt detail is student-influenced data — ALWAYS plain text
                              here, or a student could plant HTML that runs in staff browsers. */}
                          {questions.map((q, i) => (
                            <div key={i} className={`test ${q.ok ? "pass" : "fail"}`}>
                              <span className="mark">{q.ok ? "✓" : "✗"}</span>
                              <div>
                                <span>{stripHtml(q.q)}</span>
                                {!q.ok && (
                                  <div style={{ marginTop: 4, fontSize: 12 }}>
                                    picked: <b>{stripHtml(q.picked ?? "—")}</b> · correct: <b>{stripHtml(q.answer ?? "—")}</b>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          {a.kind === "CODE_RUN" && d?.code && (
                            <>
                              <div className="codeblock" style={{ margin: "8px 0" }}>
                                <pre>{d.code}</pre>
                                {d.stdout !== undefined && (
                                  <div className="out">
                                    <span className="lbl">PRINTED</span>
                                    {d.stdout || "(nothing)"}
                                  </div>
                                )}
                              </div>
                              {d.mode && <div className="meta">graded: {d.mode === "ai" ? "AI logic check" : "rule-based output test"}</div>}
                            </>
                          )}
                          {questions.length === 0 && a.kind !== "CODE_RUN" && (
                            <div className="meta">no per-question detail recorded for this attempt</div>
                          )}
                        </div>
                      </details>
                    </td>
                  </tr>
                );
              })}
              {attempts.length === 0 && (
                <tr>
                  <td style={{ color: "var(--muted)" }}>Nothing logged yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
