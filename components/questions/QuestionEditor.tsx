"use client";

// Edits ONE question of any type. Used by the test builder and (via a wrapper)
// the lesson quiz bank. Emits the full Question (with answer key).

import type { Question } from "@/lib/curriculum/questions";

export default function QuestionEditor({ q, onChange }: { q: Question; onChange: (q: Question) => void }) {
  const set = (patch: object) => onChange({ ...q, ...patch } as Question);

  return (
    <div className="qedit">
      {q.type !== "info" && (
        <div className="qedit-head">
          <textarea className="f" rows={2} value={(q as any).q || ""} placeholder="Question prompt…" onChange={(e) => set({ q: e.target.value })} />
          <label className="pts">
            pts
            <input className="f" type="number" min={0} value={q.points} onChange={(e) => set({ points: Number(e.target.value) })} />
          </label>
        </div>
      )}

      {q.type === "info" && (
        <>
          <input className="f" value={q.title || ""} placeholder="Heading (optional)" onChange={(e) => set({ title: e.target.value })} />
          <textarea className="f" style={{ marginTop: 6 }} rows={3} value={q.body || ""} placeholder="Passage / data / instructions (HTML ok) — the questions below refer to this" onChange={(e) => set({ body: e.target.value })} />
          <textarea className="f monoarea" style={{ marginTop: 6 }} rows={3} value={q.code || ""} placeholder="Code block (optional)" onChange={(e) => set({ code: e.target.value })} />
        </>
      )}

      {q.type === "mcq" && (
        <>
          {q.opts.map((opt, oi) => (
            <div className="itemrow" key={oi}>
              <input type="radio" checked={q.correct === oi} onChange={() => set({ correct: oi })} title="Correct answer" style={{ width: 18, flex: "0 0 18px" }} />
              <input className="f" value={opt} placeholder={`Option ${"ABCD"[oi] || oi + 1}`} onChange={(e) => set({ opts: q.opts.map((o, j) => (j === oi ? e.target.value : o)) })} />
              <button onClick={() => set({ opts: q.opts.filter((_, j) => j !== oi), correct: Math.max(0, q.correct - (oi < q.correct ? 1 : 0)) })}>✕</button>
            </div>
          ))}
          <button className="addbtn" style={{ width: "auto" }} onClick={() => set({ opts: [...q.opts, ""] })}>+ option</button>
          <input className="f" style={{ marginTop: 6 }} value={q.why || ""} placeholder="Why (shown after grading)" onChange={(e) => set({ why: e.target.value })} />
        </>
      )}

      {q.type === "tf" && (
        <div className="itemrow">
          <label style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <input type="radio" checked={q.correct === true} onChange={() => set({ correct: true })} /> True
          </label>
          <label style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <input type="radio" checked={q.correct === false} onChange={() => set({ correct: false })} /> False
          </label>
          <input className="f" style={{ flex: 1 }} value={q.why || ""} placeholder="Why (optional)" onChange={(e) => set({ why: e.target.value })} />
        </div>
      )}

      {q.type === "short" && (
        <>
          <div className="lbl">Accepted answers (any match = correct)</div>
          {q.answers.map((a, ai) => (
            <div className="itemrow" key={ai}>
              <input className="f" value={a} placeholder="accepted answer" onChange={(e) => set({ answers: q.answers.map((x, j) => (j === ai ? e.target.value : x)) })} />
              <button onClick={() => set({ answers: q.answers.filter((_, j) => j !== ai) })}>✕</button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <button className="addbtn" style={{ width: "auto" }} onClick={() => set({ answers: [...q.answers, ""] })}>+ accepted answer</button>
            <label style={{ fontSize: 12, display: "flex", gap: 5, alignItems: "center" }}>
              <input type="checkbox" checked={!!q.caseSensitive} onChange={(e) => set({ caseSensitive: e.target.checked })} /> case-sensitive
            </label>
          </div>
        </>
      )}

      {q.type === "long" && (
        <>
          <div className="lbl">Marking guide / rubric (for you + the AI suggester)</div>
          <textarea className="f" rows={2} value={q.rubric || ""} placeholder="e.g. 1 pt per named cause, max 3" onChange={(e) => set({ rubric: e.target.value })} />
          <div className="lbl">Sample strong answer (optional)</div>
          <textarea className="f" rows={2} value={q.sampleAnswer || ""} onChange={(e) => set({ sampleAnswer: e.target.value })} />
        </>
      )}

      {q.type === "code" && (
        <>
          <div className="lbl">Starter code (optional)</div>
          <textarea className="f monoarea" rows={3} value={q.starter || ""} onChange={(e) => set({ starter: e.target.value })} />
          <div className="lbl">Expected output</div>
          <textarea className="f" rows={2} value={q.expected || ""} onChange={(e) => set({ expected: e.target.value })} />
          <div className="lbl">stdin (optional)</div>
          <input className="f" value={q.stdin || ""} onChange={(e) => set({ stdin: e.target.value })} />
        </>
      )}
    </div>
  );
}
