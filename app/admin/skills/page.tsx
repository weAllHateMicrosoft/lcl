import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import Forbidden from "@/components/Forbidden";
import SkillsWorkspace from "@/components/teacher/SkillsWorkspace";

// The syllabus builder (STUDENT-MODEL.md §4.1). Curriculum-level, so admin-only
// like the lesson editor.
export default async function SkillsPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "ADMIN") return <Forbidden need="Admin" />;

  const chapters = await prisma.chapter.findMany({
    orderBy: { order: "asc" },
    include: { lessons: { orderBy: { order: "asc" }, select: { id: true, code: true, title: true } } },
  });
  const lessons = chapters.flatMap((c) =>
    c.lessons.map((l) => ({ id: l.id, code: l.code, title: l.title, chapter: c.title }))
  );

  return (
    <div className="main" style={{ maxWidth: 1000 }}>
      <div className="crumb">CURRICULUM · SKILL MAP</div>
      <h1 className="title" style={{ marginBottom: 4 }}>Skill map</h1>
      <p style={{ color: "var(--muted)", marginTop: 0, maxWidth: 640 }}>
        The AI reads a lesson's real questions and proposes the <b>skills</b> they test —
        a draft you confirm, rename, or delete. It's a suggestion, never the last word.
        Skills a student never gets questions on are <b>blind spots</b> for mastery, so
        they're flagged below.
      </p>
      <SkillsWorkspace lessons={lessons} />
    </div>
  );
}
