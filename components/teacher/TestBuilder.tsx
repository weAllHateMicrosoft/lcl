"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import QuestionEditor from "@/components/questions/QuestionEditor";
import { blankQuestion, maxPoints, QUESTION_TYPES, type Question, type QType } from "@/lib/curriculum/questions";

export default function TestBuilder({ id }: { id: string }) {
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [classId, setClassId] = useState("");
  const [timeLimit, setTimeLimit] = useState<string>("");
  const [closeAt, setCloseAt] = useState("");
  const [published, setPublished] = useState(false);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [saveState, setSaveState] = useState("");
  const [genOpen, setGenOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const state = useRef<any>({});
  state.current = { title, questions, classId, timeLimit, closeAt };

  useEffect(() => {
    fetch(`/api/tests/${id}`).then((r) => r.json()).then((d) => {
      if (d.test) {
        setTitle(d.test.title);
        setQuestions(d.test.questions || []);
        setClassId(d.test.classId || "");
        setTimeLimit(d.test.timeLimit ? String(d.test.timeLimit) : "");
        setCloseAt(d.test.closeAt ? new Date(d.test.closeAt).toISOString().slice(0, 16) : "");
        setPublished(d.test.published);
      }
    });
    fetch("/api/tests").then((r) => r.json()).then((d) => setClasses(d.classes || []));
  }, [id]);

  function scheduleSave() {
    setSaveState("saving…");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 700);
  }
  async function save() {
    const s = state.current;
    await fetch("/api/tests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save",
        id,
        title: s.title,
        questions: s.questions,
        classId: s.classId || null,
        timeLimit: s.timeLimit ? Number(s.timeLimit) : null,
        closeAt: s.closeAt || null,
      }),
    });
    setSaveState("saved ✓");
  }
  function edit(fn: () => void) {
    fn();
    scheduleSave();
  }

  const setQ = (i: number, q: Question) => setQuestions((qs) => qs.map((x, j) => (j === i ? q : x)));
  const addQ = (t: QType) => { setQuestions((qs) => [...qs, blankQuestion(t)]); scheduleSave(); };
  const delQ = (i: number) => { setQuestions((qs) => qs.filter((_, j) => j !== i)); scheduleSave(); };
  const move = (i: number, d: -1 | 1) =>
    setQuestions((qs) => {
      const n = [...qs];
      const j = i + d;
      if (j < 0 || j >= n.length) return qs;
      [n[i], n[j]] = [n[j], n[i]];
      scheduleSave();
      return n;
    });

  async function togglePublish() {
    await save();
    await fetch("/api/tests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish", id, published: !published }) });
    setPublished(!published);
  }

  async function aiGenerate(prompt: string, count: number) {
    setGenOpen(false);
    setSaveState("AI generating…");
    const d = await fetch("/api/tests/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, count }) }).then((r) => r.json());
    if (d.questions?.length) {
      setQuestions((qs) => [...qs, ...d.questions]);
      scheduleSave();
    } else setSaveState(d.error || "AI returned nothing");
  }

  return (
    <div className="main" style={{ maxWidth: 820 }}>
      <div className="crumb">
        <Link href="/tests" style={{ textDecoration: "underline dotted" }}>TESTS</Link> · BUILD
      </div>
      <div className="edbar" style={{ marginTop: 8 }}>
        <input className="f" style={{ flex: 1, fontFamily: "var(--serif)", fontSize: 20, fontWeight: 700 }} value={title} onChange={(e) => edit(() => setTitle(e.target.value))} placeholder="Test title" />
        <span className="save">{saveState}</span>
        <span className={`statuschip ${published ? "live" : "draft"}`}>{published ? "PUBLISHED" : "DRAFT"}</span>
        <button className={`btn ${published ? "ghost" : "green"}`} onClick={togglePublish}>{published ? "Unpublish" : "Publish"}</button>
      </div>

      <div className="panel" style={{ padding: "14px 18px" }}>
        <div className="testsettings">
          <label className="field" style={{ margin: 0 }}>
            <span className="l">Assign to class</span>
            <select className="f" value={classId} onChange={(e) => edit(() => setClassId(e.target.value))}>
              <option value="">— everyone / unassigned —</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="field" style={{ margin: 0 }}>
            <span className="l">Time limit (min)</span>
            <input className="f" type="number" min={0} value={timeLimit} onChange={(e) => edit(() => setTimeLimit(e.target.value))} placeholder="untimed" />
          </label>
          <label className="field" style={{ margin: 0 }}>
            <span className="l">Closes at</span>
            <input className="f" type="datetime-local" value={closeAt} onChange={(e) => edit(() => setCloseAt(e.target.value))} />
          </label>
        </div>
        <div className="meta">{questions.length} questions · {maxPoints(questions)} points total</div>
      </div>

      {questions.map((q, i) => (
        <div className="panel qbuild" key={q.id}>
          <div className="qbuild-head">
            <span className="qtype">{QUESTION_TYPES.find((t) => t.type === q.type)?.label}</span>
            <span style={{ flex: 1 }} />
            <button className="tbtn2" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button className="tbtn2" disabled={i === questions.length - 1} onClick={() => move(i, 1)}>↓</button>
            <button className="tbtn2 danger" onClick={() => delQ(i)}>✕</button>
          </div>
          <QuestionEditor q={q} onChange={(nq) => edit(() => setQ(i, nq))} />
        </div>
      ))}

      <div className="addbar">
        <div className="lbl">Add a question</div>
        {QUESTION_TYPES.map((t) => (
          <button key={t.type} title={t.hint} onClick={() => addQ(t.type)}>{t.label}</button>
        ))}
        <button style={{ borderColor: "var(--violet)", color: "var(--violet)" }} onClick={() => setGenOpen(!genOpen)}>✦ AI generate</button>
      </div>

      {genOpen && <AiGen onGo={aiGenerate} onCancel={() => setGenOpen(false)} />}
    </div>
  );
}

function AiGen({ onGo, onCancel }: { onGo: (prompt: string, count: number) => void; onCancel: () => void }) {
  const [prompt, setPrompt] = useState("");
  const [count, setCount] = useState(5);
  return (
    <div className="panel" style={{ borderColor: "var(--violet)" }}>
      <b>✦ Generate questions with AI</b>
      <p className="meta" style={{ marginTop: 4 }}>Describe the topic/level; the AI returns a mix of MCQ, T/F, and short-answer questions you can then edit.</p>
      <textarea className="f" rows={2} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder='e.g. "5 questions on photosynthesis for grade 9, mix of MCQ and short answer"' />
      <div className="runrow">
        <label style={{ fontSize: 13 }}>how many: <input type="number" min={1} max={15} value={count} onChange={(e) => setCount(Number(e.target.value))} style={{ width: 56 }} /></label>
        <button className="btn purple" onClick={() => onGo(prompt, count)} disabled={!prompt.trim()}>Generate</button>
        <button className="btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
