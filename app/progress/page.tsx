import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { studentMastery } from "@/lib/mastery";
import { latestInsights } from "@/lib/oversee";
import CoachCard from "@/components/student/CoachCard";

// The student's own progress: an AI coach note (warm, honest, refreshable) and
// their skill map by unit — including the honest "not seen enough yet" state.
// Open by design (owner: "open and free") — students see what teachers see
// about them, framed as next steps, never verdicts.
export default async function MyProgressPage() {
  const me = await currentUser();
  if (!me) redirect("/join");
  if (me.role !== "STUDENT") redirect("/class");

  const [skills, meta, insights, events] = await Promise.all([
    studentMastery(me.id),
    prisma.skill.findMany({
      where: { lessonId: { not: null } },
      include: { lesson: { select: { code: true, title: true, order: true, chapter: { select: { title: true, order: true } } } } },
    }),
    latestInsights([me.id]),
    prisma.event.findMany({ where: { userId: me.id }, orderBy: { at: "desc" }, take: 8, select: { type: true, at: true, payload: true } }),
  ]);

  const whereOf = new Map(meta.map((s) => [s.id, { unit: s.lesson!.chapter.title, unitOrder: s.lesson!.chapter.order, code: s.lesson!.code, lesson: s.lesson!.title, lessonOrder: s.lesson!.order }]));
  const unitMap = new Map<string, { order: number; lessons: Map<string, { code: string; title: string; order: number; skills: { statement: string; state: string; n: number }[] }> }>();
  for (const sk of skills) {
    const w = whereOf.get(sk.skillId);
    if (!w) continue;
    if (!unitMap.has(w.unit)) unitMap.set(w.unit, { order: w.unitOrder, lessons: new Map() });
    const u = unitMap.get(w.unit)!;
    if (!u.lessons.has(w.code)) u.lessons.set(w.code, { code: w.code, title: w.lesson, order: w.lessonOrder, skills: [] });
    u.lessons.get(w.code)!.skills.push({ statement: sk.statement, state: sk.state, n: sk.n });
  }
  const units = [...unitMap.entries()].sort((a, b) => a[1].order - b[1].order).map(([title, u]) => ({ title, lessons: [...u.lessons.values()].sort((a, b) => a.order - b.order) }));

  const got = skills.filter((s) => s.state === "strong").length;
  const ins = insights.get(me.id) || null;

  return (
    <div className="main" style={{ maxWidth: 860 }}>
      <div className="crumb">MY PROGRESS</div>
      <h1 className="title" style={{ marginBottom: 4 }}>My progress</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        {skills.length > 0
          ? <>You've shown <b>{got}</b> of <b>{skills.length}</b> skills so far. “Not seen enough yet” just means: show us — it's not a bad mark.</>
          : "Your skill map appears here as you work through lessons and answer questions."}
      </p>

      <CoachCard
        studentId={me.id}
        initial={ins ? { message: ins.payload.studentMessage, at: ins.createdAt.toISOString(), stale: ins.stale } : null}
      />

      {units.map((u) => (
        <div key={u.title} style={{ marginTop: 18 }}>
          <h2 style={{ fontFamily: "var(--serif)", fontSize: 18, margin: "0 0 6px" }}>{u.title}</h2>
          {u.lessons.map((l) => (
            <div className="panel" key={l.code} style={{ padding: "10px 16px", display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <Link href={`/lessons/${l.code}`} style={{ minWidth: 170, fontWeight: 600, textDecoration: "underline dotted var(--muted)" }}>
                {l.code} {l.title}
              </Link>
              <span style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
                {l.skills.map((s, i) => {
                  const c = s.state === "strong" ? "var(--accent)" : s.state === "weak" ? "#c98a00" : "var(--muted)";
                  const label = s.state === "strong" ? "✓ got it" : s.state === "weak" ? "keep practicing" : "not seen enough yet";
                  return (
                    <span key={i} title={label} style={{ fontSize: 12.5, padding: "2px 9px", borderRadius: 10, border: `1px solid ${c}`, color: c }}>
                      {s.statement} · {label}
                    </span>
                  );
                })}
              </span>
            </div>
          ))}
        </div>
      ))}

      {events.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <h2 style={{ fontFamily: "var(--serif)", fontSize: 18, margin: "0 0 6px" }}>Recent work</h2>
          <div className="panel" style={{ padding: "10px 16px" }}>
            {events.map((e, i) => (
              <div key={i} className="meta" style={{ margin: "3px 0" }}>
                {new Date(e.at).toLocaleDateString()} — {humanize(e.type, e.payload as any)}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function humanize(type: string, p: any): string {
  switch (type) {
    case "lesson.view": return `you opened lesson ${p?.code || ""}`;
    case "quiz.answer": return p?.correct ? "you answered a question correctly" : "you missed a question (that's how learning works)";
    case "tutor.message": return "you asked the tutor a question";
    case "code.run": return p?.compiled === false ? "you ran code that didn't compile" : "you ran your code";
    case "test.submit": return "you submitted a test";
    case "mastery.change": return `your progress moved: ${p?.from} → ${p?.to}`;
    default: return type;
  }
}
