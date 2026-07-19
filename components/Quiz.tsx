"use client";

import { useState } from "react";
import type { QuizQuestion } from "@/lib/curriculum/blocks";

// Shared MCQ quiz. Used for practice, AI-generated sets, and (locked) summative.
export default function Quiz({
  questions,
  locked = false,
  onComplete,
}: {
  questions: QuizQuestion[];
  locked?: boolean; // summative: hide explanations until submitted
  onComplete?: (r: { correct: number; total: number; score: number }) => void;
}) {
  const [picks, setPicks] = useState<Record<number, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const allAnswered = Object.keys(picks).length === questions.length;
  const correctCount = questions.filter((q, i) => picks[i] === q.correct).length;

  function submit() {
    if (!allAnswered) return;
    setSubmitted(true);
    onComplete?.({ correct: correctCount, total: questions.length, score: correctCount / questions.length });
  }

  return (
    <div className="quiz">
      {questions.map((q, i) => (
        <div className="q" key={i}>
          <div className="qt">
            {i + 1}. {q.q}
          </div>
          {q.opts.map((opt, oi) => {
            let cls = "opt";
            if (submitted) {
              if (oi === q.correct) cls += " right";
              else if (picks[i] === oi) cls += " wrong";
            } else if (picks[i] === oi) {
              cls += " right";
            }
            return (
              <button
                key={oi}
                className={cls}
                disabled={submitted}
                onClick={() => setPicks((p) => ({ ...p, [i]: oi }))}
              >
                {opt}
              </button>
            );
          })}
          {submitted && !locked && q.why && <div className="why">— {q.why}</div>}
        </div>
      ))}
      {!submitted ? (
        <button className="btn primary" disabled={!allAnswered} onClick={submit}>
          Submit ({Object.keys(picks).length}/{questions.length})
        </button>
      ) : (
        <div className="verdict ok" style={{ marginTop: 8 }}>
          {correctCount}/{questions.length} correct
        </div>
      )}
    </div>
  );
}
