import Link from "next/link";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";

// Curriculum sidebar + content area. The sidebar shows the current student's
// mastery pill per lesson.
export default async function LessonsLayout({ children }: { children: React.ReactNode }) {
  const me = await currentUser();
  const chapters = await prisma.chapter.findMany({
    orderBy: { order: "asc" },
    include: { lessons: { orderBy: { order: "asc" } } },
  });
  const progress = await prisma.progress.findMany({ where: { userId: me.id } });
  const statusByLesson = new Map(progress.map((p) => [p.lessonId, p.status]));
  const pill = (s?: string) => (s === "MASTERED" ? "m" : s === "IN_PROGRESS" ? "p" : "n");
  const pillText = (s?: string) => (s === "MASTERED" ? "MASTERED" : s === "IN_PROGRESS" ? "IN PROGRESS" : "");

  return (
    <div className="layout">
      <aside className="sidebar">
        {chapters.map((c) => (
          <div key={c.id}>
            <h4>{c.title}</h4>
            {c.lessons.map((l) => {
              const s = statusByLesson.get(l.id);
              return (
                <Link key={l.id} href={`/lessons/${l.code}`}>
                  <span>
                    <span style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 11 }}>{l.code}</span> {l.title}
                  </span>
                  {pillText(s) && <span className={`pill ${pill(s)}`}>{pillText(s)}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
