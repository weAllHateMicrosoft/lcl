import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import Forbidden from "@/components/Forbidden";
import CreateClass from "@/components/teacher/CreateClass";

// "My Classes" — the teacher hub. Each card opens that class's workspace.
export default async function MyClassesPage() {
  const me = await currentUser();
  if (!me) redirect("/login");
  if (me.role !== "TEACHER" && me.role !== "ADMIN") return <Forbidden need="Teacher" />;

  const classes = await prisma.class.findMany({
    where: me.role === "ADMIN" ? {} : { teacherId: me.id },
    include: { _count: { select: { students: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="main" style={{ maxWidth: 860 }}>
      <div className="crumb">TEACHER</div>
      <h1 className="title" style={{ marginBottom: 16 }}>My classes</h1>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14, marginBottom: 20 }}>
        {classes.map((c) => (
          <Link key={c.id} href={`/class/${c.id}`} className="classtile">
            <b style={{ fontFamily: "var(--serif)", fontSize: 18 }}>{c.name}</b>
            <div className="meta" style={{ margin: "6px 0 0" }}>
              {c._count.students} student{c._count.students === 1 ? "" : "s"} · code <code>{c.joinCode}</code>
              {c.googleCourseId ? " · 🎓 Google" : ""}
            </div>
          </Link>
        ))}
        {classes.length === 0 && <p style={{ color: "var(--muted)" }}>No classes yet — create one below.</p>}
      </div>

      <CreateClass />
    </div>
  );
}
