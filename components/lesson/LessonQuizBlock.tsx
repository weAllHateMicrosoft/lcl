"use client";

// An inline lesson quiz (a "quiz" block). Questions arrive answer-stripped;
// grading + readiness happen on the server via /api/lesson/quiz.

import { useState } from "react";
import { useRouter } from "next/navigation";
import QuestionView, { type TakerQ } from "@/components/questions/QuestionView";

type QResult = { id: string; awarded: number; max: number; auto: boolean; correct?: boolean; note?: string };

export default function LessonQuizBlock({
  lessonCode,
  blockId,
  title,
  questions,
}: {
  lessonCode: string;
  blockId: string;
  title?: string;
  questions: TakerQ[];
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [results, setResults] = useState<QResult[] | null>(null);
  const [score, setScore] = useState<{ awarded: number; max: number } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    const r = await fetch("/api/lesson/quiz", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonCode, blockId, answers }),
    }).then((x) => x.json());
    if (!r.error) {
      setResults(r.results || []);
      setScore({ awarded: r.awarded, max: r.max });
      router.refresh(); // readiness bar updates
    }
    setBusy(false);
  }

  function reset() {
    setResults(null);
    setScore(null);
    setAnswers({});
  }

  const rById = new Map((results || []).map((r) => [r.id, r]));
  let n = 0;

  return (
    <div className="panel lessonquiz">
      <h2>
        📝 {title || "Quick check"} <span className="tag o">IN-LESSON QUIZ</span>
      </h2>
      {questions.map((q) => {
        if (q.type !== "info") n++;
        return (
          <QuestionView
            key={q.id}
            question={q}
            index={n}
            answer={answers[q.id]}
            onAnswer={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
            result={results ? rById.get(q.id) || null : null}
          />
        );
      })}
      {!results ? (
        <button className="btn green" onClick={submit} disabled={busy}>
          {busy ? "checking…" : "Check answers"}
        </button>
      ) : (
        <div className="row-btns" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span className={`verdict ${score && score.awarded >= score.max * 0.7 ? "ok" : "bad"}`}>
            Scored {score?.awarded}/{score?.max}
          </span>
          <button className="btn ghost" onClick={reset}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
