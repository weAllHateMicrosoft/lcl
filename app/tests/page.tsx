import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import TestList from "@/components/teacher/TestList";

export default async function TestsPage() {
  const me = await currentUser();
  if (!me) redirect("/join");
  // Teachers manage tests inside each class's Assignments tab now.
  if (me.role !== "STUDENT") redirect("/class");

  // ─── Student view: assigned tests + their status ───
  if (me.role === "STUDENT") {
    const tests = await prisma.test.findMany({
      where: { published: true, OR: [{ classId: me.classId }, { classId: null }] },
      orderBy: { createdAt: "desc" },
    });
    const subs = await prisma.testSubmission.findMany({ where: { userId: me.id } });
    const subByTest = new Map(subs.map((s) => [s.testId, s]));

    return (
      <div className="main">
        <div className="crumb">TESTS &amp; QUIZZES</div>
        <h1 className="title" style={{ marginBottom: 16 }}>Your tests</h1>
        {tests.length === 0 && <p style={{ color: "var(--muted)" }}>No tests assigned yet.</p>}
        {tests.map((t) => {
          const s = subByTest.get(t.id);
          const now = Date.now();
          const closed = t.closeAt && now > t.closeAt.getTime();
          const notOpen = t.openAt && now < t.openAt.getTime();
          return (
            <div className="panel" key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px" }}>
              <div>
                <b style={{ fontFamily: "var(--serif)", fontSize: 17 }}>{t.title}</b>
                <div className="meta" style={{ margin: 0 }}>
                  {(t.questions as any[]).length} questions
                  {t.timeLimit ? ` · ${t.timeLimit} min` : ""}
                  {t.closeAt ? ` · closes ${new Date(t.closeAt).toLocaleString()}` : ""}
                </div>
              </div>
              <span style={{ flex: 1 }} />
              {s ? (
                t.resultsReleased ? (
                  <Link className="btn" href={`/tests/${t.id}/result`} style={{ textDecoration: "none" }}>
                    View result{s.status === "graded" ? ` · ${s.finalScore}/${s.maxScore}` : ""} →
                  </Link>
                ) : (
                  <span className="score ok">submitted{s.status === "graded" ? " · marked, awaiting release" : " · awaiting marks"}</span>
                )
              ) : closed ? (
                <span className="score bad">closed</span>
              ) : notOpen ? (
                <span style={{ color: "var(--muted)" }}>opens {new Date(t.openAt!).toLocaleString()}</span>
              ) : (
                <a className="btn orange" href={`/exam/test/${t.id}`} target="_blank" rel="noopener" style={{ textDecoration: "none" }}>
                  Start →
                </a>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ─── Teacher/admin view: manage tests ───
  return (
    <div className="main" style={{ maxWidth: 900 }}>
      <div className="crumb">TEST CENTRE</div>
      <h1 className="title" style={{ marginBottom: 16 }}>Tests</h1>
      <TestList />
    </div>
  );
}
