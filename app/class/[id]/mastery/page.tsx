import Link from "next/link";
import { authClass } from "@/lib/classauth";
import { prisma } from "@/lib/db";
import { studentMastery, rollup, getMasteryConfig } from "@/lib/mastery";
import { latestInsights } from "@/lib/oversee";
import MasteryTuning from "@/components/teacher/MasteryTuning";
import ProgressBoard, { type StudentCard } from "@/components/teacher/ProgressBoard";

// The class Progress tab: for each student — the AI overseer's brief (honest,
// evidence-cited, refreshable), unit-by-unit skill mastery, and their actual
// recent activity. The AI proposes; the teacher stays in charge.
export default async function ProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { me } = await authClass(id);

  const [students, cfg, skillMeta] = await Promise.all([
    prisma.user.findMany({ where: { classId: id, role: "STUDENT" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getMasteryConfig(),
    prisma.skill.findMany({
      where: { lessonId: { not: null } },
      include: { lesson: { select: { code: true, title: true, order: true, chapter: { select: { title: true, order: true } } } } },
    }),
  ]);

  const insights = await latestInsights(students.map((s) => s.id));

  // skillId → where it lives (for unit grouping)
  const whereOf = new Map(
    skillMeta.map((s) => [s.id, { unit: s.lesson!.chapter.title, unitOrder: s.lesson!.chapter.order, code: s.lesson!.code, lesson: s.lesson!.title, lessonOrder: s.lesson!.order }])
  );

  const cards: StudentCard[] = [];
  for (const st of students) {
    const skills = await studentMastery(st.id);

    // group into unit → lesson → skills
    const unitMap = new Map<string, { order: number; lessons: Map<string, { code: string; title: string; order: number; skills: { statement: string; state: string; estimate: number; n: number }[] }> }>();
    for (const sk of skills) {
      const w = whereOf.get(sk.skillId);
      if (!w) continue;
      if (!unitMap.has(w.unit)) unitMap.set(w.unit, { order: w.unitOrder, lessons: new Map() });
      const u = unitMap.get(w.unit)!;
      if (!u.lessons.has(w.code)) u.lessons.set(w.code, { code: w.code, title: w.lesson, order: w.lessonOrder, skills: [] });
      u.lessons.get(w.code)!.skills.push({ statement: sk.statement, state: sk.state, estimate: sk.estimate, n: sk.n });
    }
    const units = [...unitMap.entries()]
      .sort((a, b) => a[1].order - b[1].order)
      .map(([title, u]) => ({
        title,
        lessons: [...u.lessons.values()].sort((a, b) => a.order - b.order),
      }));

    // recent activity, humanized
    const events = await prisma.event.findMany({ where: { userId: st.id }, orderBy: { at: "desc" }, take: 10, select: { type: true, at: true, payload: true } });
    const activity = events.map((e) => ({ at: e.at.toISOString(), line: humanize(e.type, e.payload as any) }));
    const lastActive = events[0]?.at?.toISOString() ?? null;

    const ins = insights.get(st.id) || null;
    cards.push({
      id: st.id,
      name: st.name,
      lastActive,
      units,
      rollup: rollup(skills),
      activity,
      insight: ins ? { payload: ins.payload, createdAt: ins.createdAt.toISOString(), stale: ins.stale } : null,
    });
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 20, margin: "4px 0" }}>Student progress</h2>
        <span className="meta">
          AI briefs read the full record — curriculum, answers, activity, tutor questions ·{" "}
          <Link href="/admin/skills" style={{ textDecoration: "underline" }}>skill map</Link>
        </span>
      </div>
      {students.length === 0 ? (
        <div className="panel" style={{ color: "var(--muted)" }}>No students yet — progress appears as they join and work.</div>
      ) : (
        <ProgressBoard classId={id} students={cards} />
      )}
      {me.role === "ADMIN" && <MasteryTuning initial={cfg} />}
    </div>
  );
}

function humanize(type: string, p: any): string {
  switch (type) {
    case "lesson.view": return `opened lesson ${p?.code || ""}`;
    case "quiz.answer": return `${p?.correct ? "answered correctly" : "missed a question"}${p?.source === "test" ? " (test)" : ""}`;
    case "tutor.message": return `asked the tutor: “${String(p?.question || "").slice(0, 60)}${String(p?.question || "").length > 60 ? "…" : ""}”`;
    case "code.run": return p?.compiled === false ? "ran code (didn't compile)" : "ran code";
    case "test.submit": return `submitted a test (${p?.autoScore}/${p?.maxScore} auto)`;
    case "mastery.change": return `progress: ${p?.from} → ${p?.to}`;
    default: return type;
  }
}
