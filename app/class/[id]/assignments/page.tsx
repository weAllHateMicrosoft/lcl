import Link from "next/link";
import { authClass } from "@/lib/classauth";
import { prisma } from "@/lib/db";
import { normalizeQuestions, maxPoints } from "@/lib/curriculum/questions";
import NewTestButton from "@/components/teacher/class/NewTestButton";
import AssignmentControls from "@/components/teacher/class/AssignmentControls";

export default async function AssignmentsTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await authClass(id);
  const tests = await prisma.test.findMany({
    where: { classId: id },
    include: { _count: { select: { submissions: true } } },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <>
      <div className="panel">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h2 style={{ margin: 0 }}>Assignments &amp; tests</h2>
          <span style={{ flex: 1 }} />
          <NewTestButton classId={id} />
        </div>
        <p className="meta" style={{ marginTop: 6 }}>Published tests auto-post to the linked Google Classroom as assignments (with due dates).</p>
      </div>

      {tests.length === 0 && <p style={{ color: "var(--muted)" }}>No assignments yet — create one above.</p>}
      {tests.map((t) => (
        <div className="panel" key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px" }}>
          <div>
            <b style={{ fontFamily: "var(--serif)", fontSize: 16 }}>{t.title}</b>{" "}
            <span className={`statuschip ${t.published ? "live" : "draft"}`}>{t.published ? "PUBLISHED" : "DRAFT"}</span>
            {t.googleCourseWorkId && <span className="statuschip live" style={{ marginLeft: 4 }}>🎓 SYNCED</span>}
            <div className="meta" style={{ margin: 0 }}>
              {(t.questions as any[]).length} questions · {maxPoints(normalizeQuestions(t.questions as any[]))} pts
              {t.closeAt ? ` · closes ${new Date(t.closeAt).toLocaleString()}` : ""} · {t._count.submissions} submitted
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <AssignmentControls id={t.id} published={t.published} />
          <Link className="btn ghost" href={`/tests/${t.id}/edit`}>Edit</Link>
          <Link className="btn" href={`/teacher/test/${t.id}`}>Results ({t._count.submissions})</Link>
        </div>
      ))}
    </>
  );
}
