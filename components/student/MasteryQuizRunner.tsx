"use client";

// Takes the mastery ("clean") quiz — typed questions, server-graded, the only
// path to MASTERED. Used by the full-screen /exam/[code] page.

import { useEffect, useState } from "react";
import QuestionView, { type TakerQ } from "@/components/questions/QuestionView";

export default function MasteryQuizRunner({ lessonCode, lessonTitle }: { lessonCode: string; lessonTitle: string }) {
  const [questions, setQuestions] = useState<TakerQ[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [attempt, setAttempt] = useState(1);
  const [result, setResult] = useState<null | { passed: boolean; pct: number }>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/quiz?lessonCode=${encodeURIComponent(lessonCode)}`)
      .then((r) => r.json())
      .then((d) => setQuestions(d.questions || []));
  }, [lessonCode, attempt]);

  async function submit() {
    if (busy) return;
    setBusy(true);
    const r = await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonCode, answers }),
    }).then((x) => x.json());
    setBusy(false);
    if (!r.error) setResult({ passed: r.passed, pct: Math.round((r.score || 0) * 100) });
  }

  if (questions === null) return <p style={{ color: "var(--muted)" }}>loading questions…</p>;
  if (questions.length === 0) return <p style={{ color: "var(--muted)" }}>This lesson has no mastery quiz yet.</p>;

  if (result) {
    return (
      <div className={`sebres ${result.passed ? "pass" : "fail"}`} style={{ display: "block" }}>
        {result.passed
          ? `✓ ${result.pct}% — ${lessonTitle} → MASTERED. You can close this tab.`
          : `✗ ${result.pct}% — below 75%. Logged; the topic stays In Progress.`}
        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          {!result.passed && (
            <button className="btn orange" onClick={() => { setResult(null); setAnswers({}); setAttempt((a) => a + 1); }}>
              Retake now
            </button>
          )}
          <button className="btn ghost" onClick={() => window.close()}>Close tab</button>
        </div>
      </div>
    );
  }

  let n = 0;
  return (
    <>
      {questions.map((q) => {
        if (q.type !== "info") n++;
        return (
          <QuestionView key={q.id} question={q} index={n} answer={answers[q.id]} onAnswer={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
        );
      })}
      <button className="btn green" style={{ marginTop: 16 }} onClick={submit} disabled={busy}>
        {busy ? "submitting…" : "Submit clean quiz"}
      </button>
    </>
  );
}
