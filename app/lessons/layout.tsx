import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";

// Prototype-v4 sidebar: topic rows with status dots, lesson code minis, legend.
export default async function LessonsLayout({ children }: { children: React.ReactNode }) {
  const me = await currentUser();
  if (!me) redirect("/join");
  const chapters = await prisma.chapter.findMany({
    orderBy: { order: "asc" },
    include: { lessons: { orderBy: { order: "asc" } } },
  });
  const progress = await prisma.progress.findMany({ where: { userId: me.id } });
  const statusByLesson = new Map(progress.map((p) => [p.lessonId, p.status]));
  const dot = (s?: string) => (s === "MASTERED" ? "m" : s === "IN_PROGRESS" ? "p" : "n");

  return (
    <div className="shell">
      <aside className="side">
        {chapters.map((c) => (
          <div key={c.id}>
            <h3>{c.title}</h3>
            {c.lessons.map((l) => (
              <Link key={l.id} href={`/lessons/${l.code}`} className="topic">
                <span className={`dot ${dot(statusByLesson.get(l.id))}`} />
                {l.title}
                <span className="mini">{l.code}</span>
              </Link>
            ))}
          </div>
        ))}
        <div className="legend">
          TOPIC STATUS
          <div>
            <span className="dot m" /> Mastered — clean quiz passed
          </div>
          <div>
            <span className="dot p" /> In progress
          </div>
          <div>
            <span className="dot n" /> Not started
          </div>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
