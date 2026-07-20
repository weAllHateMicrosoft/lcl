"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Question } from "@/lib/curriculum/questions";

// The correct/model answer for display while marking.
function modelAnswer(q: any): string {
  switch (q.type) {
    case "mcq": return q.opts?.[q.correct] ?? "";
    case "tf": return String(q.correct);
    case "short": return (q.answers || []).join("  /  ");
    case "code": return q.expected || "";
    case "long": return q.sampleAnswer || q.rubric || "";
    default: return "";
  }
}

type QResult = { id: string; type: string; awarded: number; max: number; auto: boolean; correct?: boolean; note?: string };
type Sub = { id: string; name: string; answers: Record<string, unknown>; results: QResult[] | null; autoScore: number; maxScore: number; finalScore: number | null; status: string };

export default function TestGrader({ id }: { id: string }) {
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [released, setReleased] = useState(false);

  async function load() {
    const d = await fetch(`/api/tests/${id}/grade`).then((r) => r.json());
    setTitle(d.title || "");
    setQuestions(d.questions || []);
    setSubs(d.submissions || []);
    setReleased(d.resultsReleased || false);
  }

  async function toggleRelease() {
    const next = !released;
    setReleased(next);
    await fetch("/api/tests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "releaseResults", id, released: next }) });
  }
  useEffect(() => {
    load();
  }, [id]);

  const qById = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);
  const graded = subs.filter((s) => s.status === "graded");
  const avg = graded.length ? Math.round((graded.reduce((s, x) => s + (x.finalScore ?? 0) / (x.maxScore || 1), 0) / graded.length) * 100) : null;
  const current = subs.find((s) => s.id === active) || null;

  return (
    <>
      <div className="crumb">
        <Link href="/tests" style={{ textDecoration: "underline dotted" }}>TESTS</Link> · RESULTS
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
        <h1 className="title" style={{ margin: 0 }}>{title}</h1>
        <span style={{ flex: 1 }} />
        <span className={`statuschip ${released ? "live" : "draft"}`}>{released ? "RESULTS RELEASED" : "RESULTS HIDDEN"}</span>
        <button className={`btn ${released ? "ghost" : "green"}`} onClick={toggleRelease}>
          {released ? "Hide results from students" : "Release results to students"}
        </button>
      </div>
      <div className="kpis" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        <div className="kpi"><div className="n"><em>{subs.length}</em></div><p>submitted</p></div>
        <div className="kpi"><div className="n"><em>{graded.length}</em></div><p>fully graded</p></div>
        <div className="kpi"><div className="n"><em>{avg === null ? "—" : `${avg}%`}</em></div><p>class average</p></div>
      </div>

      {!current ? (
        <div className="dashgrid">
          <table>
            <thead><tr><th>Student</th><th>Auto</th><th>Final</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {subs.length === 0 && <tr><td colSpan={5} style={{ color: "var(--muted)" }}>No submissions yet.</td></tr>}
              {subs.map((s) => (
                <tr key={s.id}>
                  <td className="name">{s.name}</td>
                  <td>{s.autoScore}/{s.maxScore}</td>
                  <td>{s.finalScore ?? "—"}/{s.maxScore}</td>
                  <td><span className={`statuschip ${s.status === "graded" ? "live" : "draft"}`}>{s.status === "graded" ? "GRADED" : "NEEDS MARKING"}</span></td>
                  <td><button className="btn ghost" style={{ padding: "5px 12px" }} onClick={() => setActive(s.id)}>Mark →</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Marking sub={current} qById={qById} testId={id} onBack={() => setActive(null)} onSaved={() => { load(); setActive(null); }} />
      )}
    </>
  );
}

function Marking({ sub, qById, testId, onBack, onSaved }: { sub: Sub; qById: Map<string, Question>; testId: string; onBack: () => void; onSaved: () => void }) {
  const [results, setResults] = useState<QResult[]>(sub.results || []);
  const [busyAi, setBusyAi] = useState<string | null>(null);
  const total = results.reduce((s, r) => s + (Number(r.awarded) || 0), 0);
  const max = results.reduce((s, r) => s + r.max, 0);

  const setAwarded = (qid: string, v: number) => setResults((rs) => rs.map((r) => (r.id === qid ? { ...r, awarded: v } : r)));
  const setNote = (qid: string, note: string) => setResults((rs) => rs.map((r) => (r.id === qid ? { ...r, note } : r)));

  async function aiSuggest(r: QResult) {
    const q = qById.get(r.id) as any;
    if (!q || (q.type !== "long" && q.type !== "code")) return;
    setBusyAi(r.id);
    const d = await fetch(`/api/tests/${testId}/grade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "aiSuggest", question: q.q, rubric: q.rubric, expected: q.expected, isCode: q.type === "code", max: r.max, answer: sub.answers[r.id] }),
    }).then((x) => x.json());
    if (typeof d.score === "number") {
      setAwarded(r.id, d.score);
      setNote(r.id, `AI: ${d.feedback}`);
    }
    setBusyAi(null);
  }

  async function saveGrade() {
    await fetch(`/api/tests/${testId}/grade`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionId: sub.id, results }) });
    onSaved();
  }

  return (
    <div>
      <div className="edbar">
        <button className="btn ghost" onClick={onBack}>← All students</button>
        <b style={{ fontFamily: "var(--serif)", fontSize: 18 }}>{sub.name}</b>
        <span style={{ flex: 1 }} />
        <b>{total}/{max}</b>
        <button className="btn green" onClick={saveGrade}>Save grade</button>
      </div>

      {results.map((r) => {
        const q = qById.get(r.id);
        if (!q) return null;
        const ans = sub.answers[r.id];
        return (
          <div className="panel" key={r.id} style={{ padding: "14px 18px" }}>
            <div className="qh"><span dangerouslySetInnerHTML={{ __html: (q as any).q || "" }} /></div>
            <div className="gradeans">
              <b>Student answer:</b>{" "}
              {q.type === "mcq" ? ((q as any).opts[Number(ans)] ?? "—") : q.type === "tf" ? String(ans) : <span style={{ whiteSpace: "pre-wrap", fontFamily: q.type === "code" ? "var(--mono)" : "inherit" }}>{String(ans ?? "—")}</span>}
            </div>
            {modelAnswer(q) && (
              <div className="gradeans" style={{ background: "#e7f2ec", borderLeft: "3px solid var(--accent)" }}>
                <b>{q.type === "long" ? "Model answer / rubric:" : "Correct answer:"}</b>{" "}
                <span style={{ whiteSpace: "pre-wrap", fontFamily: q.type === "code" ? "var(--mono)" : "inherit" }}>{modelAnswer(q)}</span>
              </div>
            )}
            {r.auto && <div className="meta">auto: {r.correct ? "correct" : "incorrect"}{r.note ? ` · ${r.note}` : ""}</div>}
            <div className="graderow">
              <input type="number" min={0} max={r.max} value={r.awarded} onChange={(e) => setAwarded(r.id, Math.max(0, Math.min(r.max, Number(e.target.value))))} /> / {r.max}
              {(q.type === "long" || q.type === "code") && (
                <button className="btn purple" style={{ padding: "6px 12px" }} disabled={busyAi === r.id} onClick={() => aiSuggest(r)}>
                  {busyAi === r.id ? "…" : "✦ AI grade"}
                </button>
              )}
              <input className="f" style={{ flex: 1 }} value={r.note || ""} placeholder="note / feedback (optional)" onChange={(e) => setNote(r.id, e.target.value)} />
            </div>
          </div>
        );
      })}
      <button className="btn green" onClick={saveGrade} style={{ marginTop: 6 }}>Save grade ({total}/{max})</button>
    </div>
  );
}
