"use client";

import { useState } from "react";

type Lesson = { id: string; code: string; title: string; chapter: string };
type Skill = { id: string; statement: string; difficulty: number | null; origin: string; confidence: number; questionCount: number };
type Gaps = { untaggedQuestions: { id: string; text: string }[]; emptySkills: string[] };

export default function SkillsWorkspace({ lessons }: { lessons: Lesson[] }) {
  const [lessonId, setLessonId] = useState<string>(lessons[0]?.id ?? "");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [gaps, setGaps] = useState<Gaps>({ untaggedQuestions: [], emptySkills: [] });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const lesson = lessons.find((l) => l.id === lessonId);

  async function load(id: string) {
    setLoading(true);
    setLoaded(false);
    setNote(null);
    const d = await fetch(`/api/curriculum/skills?lessonId=${id}`).then((r) => r.json());
    setSkills(d.skills || []);
    setGaps(d.gaps || { untaggedQuestions: [], emptySkills: [] });
    setLoading(false);
    setLoaded(true);
  }

  function pick(id: string) {
    setLessonId(id);
    load(id);
  }

  async function act(payload: Record<string, unknown>, label = "") {
    setBusy(label);
    const d = await fetch("/api/curriculum/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, lessonId }),
    }).then((r) => r.json());
    if (d.skills) setSkills(d.skills);
    if (d.gaps) setGaps(d.gaps);
    if ("note" in d) setNote(d.note);
    setBusy("");
    setLoaded(true);
  }

  const analyze = () => act({ action: "analyze" }, "analyze");

  return (
    <div className="dashgrid" style={{ marginTop: 12 }}>
      {/* lesson picker */}
      <div className="edbar" style={{ marginBottom: 12 }}>
        <label className="field" style={{ margin: 0, flex: 1 }}>
          <span className="l">Lesson</span>
          <select className="f" value={lessonId} onChange={(e) => pick(e.target.value)}>
            {lessons.length === 0 && <option value="">— no lessons yet —</option>}
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.code} · {l.title} ({l.chapter})
              </option>
            ))}
          </select>
        </label>
        <button className="btn purple" disabled={!lessonId || busy === "analyze"} onClick={analyze}>
          {busy === "analyze" ? "✦ reading questions…" : "✦ Analyse with AI"}
        </button>
      </div>

      {!loaded && !loading && (
        <p style={{ color: "var(--muted)" }}>
          Pick a lesson and hit <b>Analyse with AI</b> — or it loads the existing map when you switch lessons.
        </p>
      )}
      {loading && <p style={{ color: "var(--muted)" }}>Loading…</p>}
      {note && <div className="panel" style={{ borderColor: "var(--violet)", color: "var(--muted)" }}>{note}</div>}

      {loaded && !loading && (
        <>
          {/* skills */}
          <h2 style={{ fontFamily: "var(--serif)", fontSize: 18, margin: "6px 0 8px" }}>
            Skills {skills.length > 0 && <span style={{ color: "var(--muted)", fontWeight: 400 }}>({skills.length})</span>}
          </h2>
          {skills.length === 0 && (
            <p style={{ color: "var(--muted)" }}>No skills yet for {lesson?.code}. Run the analysis, or add one by hand below.</p>
          )}
          {skills.map((s) => (
            <SkillRow key={s.id} s={s} busy={busy} onAct={act} />
          ))}

          <AddSkill onAdd={(statement) => act({ action: "add", statement }, "add")} busy={busy === "add"} />

          {/* gaps */}
          {(gaps.untaggedQuestions.length > 0 || gaps.emptySkills.length > 0) && (
            <div className="panel" style={{ marginTop: 16, borderColor: "var(--amber, #c98a00)" }}>
              <b>⚠ Blind spots</b>
              {gaps.emptySkills.length > 0 && (
                <p className="meta" style={{ marginTop: 6 }}>
                  <b>{gaps.emptySkills.length} skill(s) have no questions measuring them</b> — the mastery signal
                  is blind here: {gaps.emptySkills.map((s) => `“${s}”`).join(", ")}.
                </p>
              )}
              {gaps.untaggedQuestions.length > 0 && (
                <p className="meta" style={{ marginTop: 6 }}>
                  <b>{gaps.untaggedQuestions.length} question(s) aren't tied to any skill</b> — their evidence
                  won't count toward mastery until tagged.
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SkillRow({ s, busy, onAct }: { s: Skill; busy: string; onAct: (p: Record<string, unknown>, label?: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(s.statement);
  const confirmed = s.origin === "teacher";

  return (
    <div className="panel" style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px" }}>
      <span className={`statuschip ${confirmed ? "live" : "draft"}`} title={confirmed ? "confirmed by you" : "AI suggestion — confirm or edit"}>
        {confirmed ? "CONFIRMED" : "AI"}
      </span>
      {editing ? (
        <input
          className="f"
          style={{ flex: 1 }}
          value={text}
          autoFocus
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { onAct({ action: "rename", skillId: s.id, statement: text }); setEditing(false); }
            if (e.key === "Escape") { setText(s.statement); setEditing(false); }
          }}
        />
      ) : (
        <span style={{ flex: 1 }}>
          {s.statement}
          {s.difficulty ? <span className="meta" style={{ marginLeft: 8 }}>· difficulty {s.difficulty}/5</span> : null}
          <span className="meta" style={{ marginLeft: 8 }}>· {s.questionCount} question{s.questionCount === 1 ? "" : "s"}</span>
        </span>
      )}
      {editing ? (
        <button className="btn green" style={{ padding: "5px 12px" }} onClick={() => { onAct({ action: "rename", skillId: s.id, statement: text }); setEditing(false); }}>Save</button>
      ) : (
        <>
          {!confirmed && (
            <button className="btn green" style={{ padding: "5px 12px" }} disabled={!!busy} onClick={() => onAct({ action: "confirm", skillId: s.id })}>Confirm</button>
          )}
          <button className="btn ghost" style={{ padding: "5px 10px" }} onClick={() => setEditing(true)}>Edit</button>
          <button className="tbtn2 danger" title="delete" onClick={() => onAct({ action: "delete", skillId: s.id })}>✕</button>
        </>
      )}
    </div>
  );
}

function AddSkill({ onAdd, busy }: { onAdd: (s: string) => void; busy: boolean }) {
  const [text, setText] = useState("");
  return (
    <div className="edbar" style={{ marginTop: 4 }}>
      <input
        className="f"
        style={{ flex: 1 }}
        placeholder="add a skill by hand — e.g. “trace a nested loop”"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) { onAdd(text.trim()); setText(""); } }}
      />
      <button className="btn ghost" disabled={!text.trim() || busy} onClick={() => { onAdd(text.trim()); setText(""); }}>+ Add</button>
    </div>
  );
}
