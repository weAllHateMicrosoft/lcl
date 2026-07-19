"use client";

import { useState } from "react";
import type { QuizQuestion } from "@/lib/curriculum/blocks";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

// Prototype-v4 quiz: numbered questions, lettered options, batch submit,
// per-question "why" explanations after grading.
// Two grading modes:
// - local (default): questions carry `correct`; grades in the browser (formative).
// - remote: questions arrive WITHOUT answers; submit sends picks to the server,
//   which grades and returns per-question results (summative — answer key never
//   reaches the browser).
export default function Quiz({
  questions,
  locked = false,
  submitLabel = "Submit answers",
  onComplete,
  remoteGrade,
}: {
  questions: (QuizQuestion | { q: string; opts: string[] })[];
  locked?: boolean; // summative: no explanations after submit
  submitLabel?: string;
  onComplete?: (r: {
    correct: number;
    total: number;
    score: number;
    detail: { q: string; picked: string; answer: string; ok: boolean }[];
  }) => void;
  remoteGrade?: (picks: number[]) => Promise<null | { results: { answerIndex: number; ok: boolean }[] }>;
}) {
  const [picks, setPicks] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [remote, setRemote] = useState<{ answerIndex: number; ok: boolean }[] | null>(null);

  const answered = Object.keys(picks).length;
  const answerOf = (i: number): number | undefined => (remote ? remote[i]?.answerIndex : (questions[i] as QuizQuestion).correct);
  const correctCount = questions.filter((_, i) => picks[i] === answerOf(i)).length;

  async function submit() {
    if (answered < questions.length || busy) return;
    if (remoteGrade) {
      setBusy(true);
      const r = await remoteGrade(questions.map((_, i) => picks[i]));
      setBusy(false);
      if (!r) return; // server rejected; caller surfaces the error
      setRemote(r.results);
      setSubmitted(true);
      return;
    }
    setSubmitted(true);
    const qs = questions as QuizQuestion[];
    const detail = qs.map((q, i) => ({
      q: q.q,
      picked: q.opts[picks[i]],
      answer: q.opts[q.correct],
      ok: picks[i] === q.correct,
    }));
    const correct = qs.filter((q, i) => picks[i] === q.correct).length;
    onComplete?.({ correct, total: qs.length, score: correct / qs.length, detail });
  }

  return (
    <div>
      {questions.map((q, i) => (
        <div className="qitem" key={i}>
          <div className="qh">
            <span className="n">Q{i + 1}</span>
            <span dangerouslySetInnerHTML={{ __html: q.q }} />
          </div>
          {q.opts.map((opt, oi) => {
            let cls = "opt";
            if (submitted) {
              if (oi === answerOf(i)) cls += " right";
              else if (picks[i] === oi) cls += " wrong";
            } else if (picks[i] === oi) {
              cls += " sel";
            }
            return (
              <button key={oi} className={cls} disabled={submitted} onClick={() => setPicks((p) => ({ ...p, [i]: oi }))}>
                <span className="letter">{LETTERS[oi]}</span>
                <span dangerouslySetInnerHTML={{ __html: opt }} />
              </button>
            );
          })}
          {submitted && !locked && (q as QuizQuestion).why && <div className="why">{(q as QuizQuestion).why}</div>}
        </div>
      ))}
      <div className="quizfoot">
        {!submitted ? (
          <>
            <button className="btn green" disabled={answered < questions.length || busy} onClick={submit}>
              {busy ? "grading…" : submitLabel}
            </button>
            <span className="score">
              {answered}/{questions.length} answered
            </span>
          </>
        ) : (
          <span className={`score ${correctCount / questions.length >= 0.7 ? "ok" : "bad"}`}>
            {correctCount}/{questions.length} correct ({Math.round((correctCount / questions.length) * 100)}%)
          </span>
        )}
      </div>
    </div>
  );
}
