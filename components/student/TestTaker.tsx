"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QuestionView, { type TakerQ } from "@/components/questions/QuestionView";

export default function TestTaker({ id }: { id: string }) {
  const [test, setTest] = useState<{ title: string; timeLimit?: number; questions: TakerQ[] } | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [err, setErr] = useState("");
  const [done, setDone] = useState<null | { autoScore: number; maxScore: number; needsManual: boolean }>(null);
  const [left, setLeft] = useState<number | null>(null);
  const submitting = useRef(false);

  const submit = useCallback(async () => {
    if (submitting.current || done) return;
    submitting.current = true;
    const r = await fetch(`/api/tests/${id}/submit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }) }).then((x) => x.json());
    if (r.error) {
      setErr(r.error);
      submitting.current = false;
    } else setDone(r);
  }, [id, answers, done]);

  useEffect(() => {
    fetch(`/api/tests/${id}`).then((r) => r.json()).then((d) => {
      if (d.error) return setErr(d.error);
      if (d.alreadyDone) return setErr("You've already submitted this test.");
      setTest(d.test);
      if (d.test.timeLimit) setLeft(d.test.timeLimit * 60);
    });
  }, [id]);

  // countdown; auto-submit at zero
  useEffect(() => {
    if (left === null || done) return;
    if (left <= 0) {
      submit();
      return;
    }
    const t = setTimeout(() => setLeft((l) => (l === null ? l : l - 1)), 1000);
    return () => clearTimeout(t);
  }, [left, done, submit]);

  if (err) return <div className="exambody"><div className="offline-note">{err}</div></div>;
  if (!test) return <div className="exambody"><p style={{ color: "var(--muted)" }}>loading…</p></div>;

  if (done) {
    return (
      <div className="exambody">
        <div className={`sebres pass`} style={{ display: "block" }}>
          ✓ Submitted — {test.title}
          <div style={{ marginTop: 8, fontWeight: 400 }}>
            Your answers are in. Your teacher will mark the test and release results — you'll see your score and feedback then
            under <b>Tests</b>.
          </div>
          <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => window.close()}>Close tab</button>
        </div>
      </div>
    );
  }

  const mm = left !== null ? String(Math.floor(left / 60)).padStart(2, "0") : "";
  const ss = left !== null ? String(left % 60).padStart(2, "0") : "";
  let n = 0;

  return (
    <>
      <div className="sebbar" style={{ borderRadius: 0 }}>
        <span>📝 {test.title.toUpperCase()}</span>
        <span>{left !== null ? `⏱ ${mm}:${ss}` : "untimed"} · answers saved on submit</span>
      </div>
      <div className="exambody">
        {test.questions.map((q) => {
          if (q.type !== "info") n++;
          return <QuestionView key={q.id} question={q} index={n} answer={answers[q.id]} onAnswer={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />;
        })}
        <button className="btn green" style={{ marginTop: 16 }} onClick={submit}>Submit test</button>
      </div>
    </>
  );
}
