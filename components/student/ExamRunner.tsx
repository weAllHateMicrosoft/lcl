"use client";

// The exam-taking client: fetches sans-answer questions, submits picks for
// server-side grading, shows the verdict. Used only by /exam/[code].

import { useEffect, useState } from "react";
import Quiz from "@/components/Quiz";

export default function ExamRunner({ lessonCode, lessonTitle }: { lessonCode: string; lessonTitle: string }) {
  const [questions, setQuestions] = useState<{ q: string; opts: string[] }[] | null>(null);
  const [attempt, setAttempt] = useState(1);
  const [result, setResult] = useState<null | { passed: boolean; pct: number }>(null);

  useEffect(() => {
    fetch(`/api/quiz?lessonCode=${encodeURIComponent(lessonCode)}`)
      .then((r) => r.json())
      .then((d) => setQuestions(d.questions || []));
  }, [lessonCode, attempt]);

  async function remoteGrade(picks: number[]) {
    const r = await fetch("/api/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonCode, picks }),
    }).then((x) => x.json());
    if (r.error) return null;
    setResult({ passed: r.passed, pct: Math.round(r.score * 100) });
    return { results: r.results };
  }

  if (questions === null) return <p style={{ color: "var(--muted)" }}>loading questions…</p>;
  if (questions.length === 0) return <p style={{ color: "var(--muted)" }}>This lesson has no quiz bank yet.</p>;

  return (
    <>
      <Quiz key={attempt} questions={questions} locked submitLabel="Submit clean quiz" remoteGrade={remoteGrade} />
      {result && (
        <div className={`sebres ${result.passed ? "pass" : "fail"}`} style={{ display: "block" }}>
          {result.passed
            ? `✓ ${result.pct}% — ${lessonTitle} → MASTERED. You can close this tab.`
            : `✗ ${result.pct}% — below 75%. Logged; the topic stays In Progress.`}
          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            {!result.passed && (
              <button
                className="btn orange"
                onClick={() => {
                  setResult(null);
                  setAttempt((a) => a + 1);
                }}
              >
                Retake now
              </button>
            )}
            <button className="btn ghost" onClick={() => window.close()}>
              Close tab
            </button>
          </div>
        </div>
      )}
    </>
  );
}
