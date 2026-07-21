import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import Forbidden from "@/components/Forbidden";
import Collapsible from "@/components/Collapsible";
import ClassManager from "@/components/teacher/ClassManager";
import AskTeacherToggle from "@/components/teacher/AskTeacherToggle";
import { getSetting } from "@/lib/settings";

export default async function TeacherDashboard() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "TEACHER" && me.role !== "ADMIN") return <Forbidden need="Teacher" />;

  // Teachers see their own classes' students; admin sees everyone.
  const classes = await prisma.class.findMany({
    where: me.role === "ADMIN" ? {} : { teacherId: me.id },
    include: { students: { select: { id: true, name: true }, orderBy: { name: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  const google = { connected: Boolean(me.googleRefreshToken), email: me.googleEmail };
  const studentFilter =
    me.role === "ADMIN" ? { role: "STUDENT" } : { role: "STUDENT", classId: { in: classes.map((c) => c.id) } };

  const [students, lessons] = await Promise.all([
    prisma.user.findMany({ where: studentFilter, orderBy: { createdAt: "asc" } }),
    prisma.lesson.findMany({ orderBy: [{ chapter: { order: "asc" } }, { order: "asc" }] }),
  ]);
  const studentIds = students.map((s) => s.id);
  const progress = await prisma.progress.findMany({ where: { userId: { in: studentIds } } });
  const prefs = await getSetting<{ askTeacher?: boolean }>(`prefs:${me.id}`, {});
  // Difficulty signals: how each lesson is landing across the class.
  const agg = await prisma.attempt.groupBy({
    by: ["lessonId"],
    where: { userId: { in: studentIds } },
    _count: { _all: true },
    _avg: { score: true },
  });
  const aggByLesson = new Map(agg.map((a) => [a.lessonId, a]));

  const key = (u: string, l: string) => `${u}:${l}`;
  const pmap = new Map(progress.map((p) => [key(p.userId, p.lessonId), p]));

  const stuck = progress.filter((p) => p.flag === "stuck").length;
  const coast = progress.filter((p) => p.flag === "coast").length;
  const mastered = progress.filter((p) => p.status === "MASTERED").length;
  const pct = progress.length ? Math.round((mastered / progress.length) * 100) : 0;

  const cls = (s?: string) => (s === "MASTERED" ? "m" : s === "IN_PROGRESS" ? "p" : "n");
  const txt = (s?: string) => (s === "MASTERED" ? "● MASTERED" : s === "IN_PROGRESS" ? "● IN PROGRESS" : "○ NOT STARTED");

  return (
    <div className="shell">
      <div className="dash">
        <div className="crumb">TEACHER DASHBOARD · LIVE DATA</div>
        <h1 className="title" style={{ marginBottom: 20 }}>
          Who's stuck, who's coasting
        </h1>
        <ClassManager
          google={google}
          classes={classes.map((c) => ({ id: c.id, name: c.name, joinCode: c.joinCode, students: c.students, googleCourseId: c.googleCourseId, googleCourseName: c.googleCourseName }))}
        />
        <div className="panel" style={{ marginBottom: 22, padding: "14px 18px" }}>
          <AskTeacherToggle initial={prefs.askTeacher === true} />
        </div>
        <div className="kpis">
          <div className="kpi">
            <div className="n">
              <em>{stuck}</em>
            </div>
            <p>students flagged stuck (3+ recent fails)</p>
          </div>
          <div className="kpi">
            <div className="n">
              <em>{coast}</em>
            </div>
            <p>coasting — need extension work</p>
          </div>
          <div className="kpi">
            <div className="n">
              <em>{pct}%</em>
            </div>
            <p>of started topics mastered (clean quiz only)</p>
          </div>
        </div>

        <div className="dashgrid">
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
                  <td className="name">
                    <a href={`/teacher/student/${s.id}`} style={{ textDecoration: "underline dotted var(--muted)" }} title="Full record — every attempt, every missed question">
                      {s.name}
                    </a>
                  </td>
                  {lessons.map((l) => {
                    const p = pmap.get(key(s.id, l.id));
                    return (
                      <td key={l.id} title={txt(p?.status)}>
                        <span className={`cellpill ${cls(p?.status)}`}>{p?.status === "MASTERED" ? "●" : p?.status === "IN_PROGRESS" ? "◐" : "○"}</span>
                        {p?.flag && <span className={`flag ${p.flag === "coast" ? "coast" : ""}`}>{p.flag === "stuck" ? "STUCK" : "EXTEND"}</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {agg.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <Collapsible title="Lesson difficulty signals" storageKey="t-difficulty" defaultOpen={false}>
            <div className="dashgrid">
              <table>
                <thead>
                  <tr>
                    <th>Lesson</th>
                    <th>Attempts</th>
                    <th>Avg score</th>
                    <th>Mastered</th>
                    <th>Read</th>
                  </tr>
                </thead>
                <tbody>
                  {lessons
                    .filter((l) => aggByLesson.has(l.id))
                    .sort((a, b) => (aggByLesson.get(a.id)!._avg.score ?? 1) - (aggByLesson.get(b.id)!._avg.score ?? 1))
                    .map((l) => {
                      const a = aggByLesson.get(l.id)!;
                      const avg = Math.round((a._avg.score ?? 0) * 100);
                      const masteredHere = progress.filter((p) => p.lessonId === l.id && p.status === "MASTERED").length;
                      const startedHere = progress.filter((p) => p.lessonId === l.id).length;
                      return (
                        <tr key={l.id}>
                          <td className="name">
                            {l.code} {l.title}
                          </td>
                          <td>{a._count._all}</td>
                          <td>
                            <span className={`score ${avg >= 70 ? "ok" : "bad"}`}>{avg}%</span>
                          </td>
                          <td>
                            {masteredHere}/{students.length}
                          </td>
                          <td style={{ color: "var(--muted)" }}>{startedHere} started</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            <p className="dashnote">Sorted hardest-first by average score — a low line here usually means the lesson or its quiz needs attention, not the students.</p>
            </Collapsible>
          </div>
        )}

        <p className="dashnote">
          <strong>Honesty rule:</strong> Mastered comes only from a clean, locked-down quiz. Practice, scratchpad, code runs, and
          AI-generated sets feed readiness &amp; flags — never Mastered.
        </p>
      </div>
    </div>
  );
}
