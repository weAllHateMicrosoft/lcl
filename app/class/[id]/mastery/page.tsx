import Link from "next/link";
import { authClass } from "@/lib/classauth";
import { prisma } from "@/lib/db";
import { studentMastery, rollup, getMasteryConfig, type SkillMastery } from "@/lib/mastery";
import MasteryTuning from "@/components/teacher/MasteryTuning";

// The class Mastery tab (STUDENT-MODEL.md §3–4). Reads each student's real
// answers through the skill map and shows a defensible, uncertainty-aware read.
export default async function MasteryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { me, cls } = await authClass(id);

  const [students, cfg, skillCount] = await Promise.all([
    prisma.user.findMany({ where: { classId: id, role: "STUDENT" }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getMasteryConfig(),
    prisma.skill.count({ where: { lessonId: { not: null } } }),
  ]);

  const rows = await Promise.all(
    students.map(async (s) => ({ student: s, skills: await studentMastery(s.id) }))
  );

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: 20, margin: "4px 0" }}>Skill mastery</h2>
        <span className="meta">
          read from real answers · {skillCount} skill{skillCount === 1 ? "" : "s"} defined
          {skillCount === 0 && (
            <> · <Link href="/admin/skills" style={{ textDecoration: "underline" }}>build the skill map first →</Link></>
          )}
        </span>
      </div>

      <p style={{ color: "var(--muted)", fontSize: 13.5, maxWidth: 680, marginTop: 0 }}>
        Three honest states: <b style={{ color: "var(--accent)" }}>strong</b> (shown it, confidently),{" "}
        <b style={{ color: "#c98a00" }}>weak</b> (tried, not there yet), and{" "}
        <b style={{ color: "var(--muted)" }}>not enough evidence</b> — the system won't pretend to know from too few answers.
      </p>

      {students.length === 0 && (
        <div className="panel" style={{ color: "var(--muted)" }}>
          No students in this class yet, so there's nothing to measure. Mastery lights up as students answer questions.
        </div>
      )}

      {rows.map(({ student, skills }) => {
        const r = rollup(skills);
        const weak = skills.filter((s) => s.state === "weak");
        const strong = skills.filter((s) => s.state === "strong");
        const unknown = skills.filter((s) => s.state === "unknown");
        return (
          <div className="panel" key={student.id} style={{ padding: "12px 18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <Link href={`/teacher/student/${student.id}`} style={{ fontFamily: "var(--serif)", fontSize: 16, fontWeight: 700, textDecoration: "underline dotted var(--muted)" }}>
                {student.name}
              </Link>
              <span style={{ flex: 1 }} />
              <MiniBar r={r} />
            </div>
            {r.total === 0 ? (
              <p className="meta" style={{ marginTop: 6 }}>No skills defined yet.</p>
            ) : (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                {weak.length > 0 && <SkillLine label="Needs work" color="#c98a00" skills={weak} />}
                {strong.length > 0 && <SkillLine label="Strong" color="var(--accent)" skills={strong} />}
                {unknown.length > 0 && <SkillLine label="Not enough evidence" color="var(--muted)" skills={unknown} muted />}
              </div>
            )}
          </div>
        );
      })}

      {me.role === "ADMIN" && <MasteryTuning initial={cfg} />}
    </div>
  );
}

function MiniBar({ r }: { r: { strong: number; weak: number; unknown: number; total: number } }) {
  if (r.total === 0) return null;
  const seg = (n: number, color: string) => (n > 0 ? <span style={{ flex: n, background: color, height: 8, borderRadius: 2 }} title={`${n}`} /> : null);
  return (
    <span style={{ display: "flex", gap: 2, width: 160, alignItems: "center" }}>
      {seg(r.weak, "#c98a00")}
      {seg(r.strong, "var(--accent)")}
      {seg(r.unknown, "var(--line, #ddd)")}
      <span className="meta" style={{ marginLeft: 6, whiteSpace: "nowrap" }}>{r.strong}/{r.total}</span>
    </span>
  );
}

function SkillLine({ label, color, skills, muted }: { label: string; color: string; skills: SkillMastery[]; muted?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
      <span style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color, minWidth: 130, fontWeight: 700 }}>{label}</span>
      <span style={{ display: "flex", gap: 6, flexWrap: "wrap", flex: 1 }}>
        {skills.map((s) => (
          <span
            key={s.skillId}
            title={muted ? `${s.n} answer(s) — need more to judge` : `estimate ${Math.round(s.estimate * 100)}% · confidence ${Math.round(s.confidence * 100)}% · ${s.n} answers`}
            style={{ fontSize: 12.5, padding: "2px 8px", borderRadius: 10, border: `1px solid ${color}`, opacity: muted ? 0.7 : 1 }}
          >
            {s.statement}
          </span>
        ))}
      </span>
    </div>
  );
}
