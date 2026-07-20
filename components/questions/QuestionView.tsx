"use client";

// Renders ONE question for a taker (answer key already stripped server-side).
// Used by the test taker and the clean-quiz exam. `reveal` shows correctness
// after grading (per-question result passed in).

import CodeEditor from "../CodeEditor";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export type TakerQ = {
  id: string;
  type: string;
  points: number;
  q?: string;
  opts?: string[];
  title?: string;
  body?: string;
  code?: string;
  starter?: string;
  rubric?: string;
  stdin?: string;
};

export default function QuestionView({
  question: q,
  index,
  answer,
  onAnswer,
  result,
}: {
  question: TakerQ;
  index: number;
  answer: unknown;
  onAnswer: (v: unknown) => void;
  result?: { awarded: number; max: number; correct?: boolean; note?: string; auto: boolean } | null;
}) {
  if (q.type === "info") {
    return (
      <div className="qcard info">
        {q.title && <div className="qh" style={{ fontFamily: "var(--serif)", fontSize: 17 }}>{q.title}</div>}
        {q.body && <div style={{ whiteSpace: "pre-wrap" }} dangerouslySetInnerHTML={{ __html: q.body }} />}
        {q.code && <div className="codeblock" style={{ marginTop: 10 }}><pre>{q.code}</pre></div>}
      </div>
    );
  }

  const badge = result ? (
    <span className={`score ${result.awarded >= result.max && result.max > 0 ? "ok" : "bad"}`} style={{ marginLeft: "auto" }}>
      {result.auto ? `${result.awarded}/${result.max}` : "to be marked"}
    </span>
  ) : (
    <span style={{ marginLeft: "auto", color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 11 }}>{q.points} pt{q.points === 1 ? "" : "s"}</span>
  );

  return (
    <div className="qcard">
      <div className="qh" style={{ display: "flex", gap: 8 }}>
        <span className="n">Q{index}</span>
        <span style={{ whiteSpace: "pre-wrap", flex: 1 }} dangerouslySetInnerHTML={{ __html: q.q || "" }} />
        {badge}
      </div>

      {q.type === "mcq" &&
        (q.opts || []).map((opt, oi) => (
          <button key={oi} className={`opt ${answer === oi ? "sel" : ""}`} disabled={!!result} onClick={() => onAnswer(oi)}>
            <span className="letter">{LETTERS[oi]}</span>
            <span style={{ whiteSpace: "pre-wrap", textAlign: "left" }} dangerouslySetInnerHTML={{ __html: opt }} />
          </button>
        ))}

      {q.type === "tf" &&
        [true, false].map((v) => (
          <button key={String(v)} className={`opt ${answer === v ? "sel" : ""}`} disabled={!!result} onClick={() => onAnswer(v)}>
            <span className="letter">{v ? "T" : "F"}</span>
            {v ? "True" : "False"}
          </button>
        ))}

      {q.type === "short" && (
        <input className="f" value={(answer as string) || ""} disabled={!!result} onChange={(e) => onAnswer(e.target.value)} placeholder="Your answer…" />
      )}

      {q.type === "long" && (
        <textarea className="f" rows={6} value={(answer as string) || ""} disabled={!!result} onChange={(e) => onAnswer(e.target.value)} placeholder="Write your answer…" />
      )}

      {q.type === "code" && (
        <CodeEditor value={(answer as string) ?? q.starter ?? ""} onChange={onAnswer} height="180px" />
      )}

      {result?.note && <div className="meta">{result.note}</div>}
    </div>
  );
}
