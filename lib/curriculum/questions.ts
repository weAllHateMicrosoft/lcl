// The one question model — shared by lesson quizzes AND tests, across subjects.
// Add a type here + a case in QuestionView/QuestionEditor/grading and it works
// everywhere. Deliberately not CS-specific.

export type QType = "info" | "mcq" | "tf" | "short" | "long" | "code";

export interface BaseQ {
  id: string;
  type: QType;
  points: number;
}

export type Question =
  // ungraded stimulus: a passage / dataset / code to read. Groups the questions
  // after it (this is how DBQ / "read this first" works).
  | (BaseQ & { type: "info"; title?: string; body?: string; code?: string })
  | (BaseQ & { type: "mcq"; q: string; opts: string[]; correct: number; why?: string })
  | (BaseQ & { type: "tf"; q: string; correct: boolean; why?: string })
  // short answer: any accepted string (tolerant match). Auto-graded.
  | (BaseQ & { type: "short"; q: string; answers: string[]; caseSensitive?: boolean })
  // long answer / essay: AI can suggest a mark, teacher confirms. Manual by default.
  | (BaseQ & { type: "long"; q: string; rubric?: string; sampleAnswer?: string })
  // coding: really runs; output compared to expected. Auto-graded.
  | (BaseQ & { type: "code"; q: string; starter?: string; expected?: string; stdin?: string });

export type AnswerMap = Record<string, unknown>;

export const QUESTION_TYPES: { type: QType; label: string; hint: string }[] = [
  { type: "info", label: "◈ Info / passage", hint: "ungraded reading — data, text, or code for the questions below" },
  { type: "mcq", label: "◉ Multiple choice", hint: "one correct option" },
  { type: "tf", label: "⊤ True / False", hint: "a statement that's true or false" },
  { type: "short", label: "✎ Short answer", hint: "typed answer, matched to accepted answers" },
  { type: "long", label: "¶ Long answer", hint: "essay / explanation — AI-assisted, teacher confirms" },
  { type: "code", label: "{} Coding", hint: "student writes code; output is checked" },
];

const uid = () => Math.random().toString(36).slice(2, 10);

export function blankQuestion(type: QType): Question {
  const base = { id: uid(), points: type === "info" ? 0 : 1 };
  switch (type) {
    case "info": return { ...base, type, body: "Read the following…" };
    case "mcq": return { ...base, type, q: "", opts: ["", "", "", ""], correct: 0, why: "" };
    case "tf": return { ...base, type, q: "", correct: true, why: "" };
    case "short": return { ...base, type, q: "", answers: [""] };
    case "long": return { ...base, type, q: "", rubric: "" };
    case "code": return { ...base, type, q: "", starter: "", expected: "", stdin: "" };
  }
}

// Legacy lesson quizBank items ({q,opts,correct,why}) → typed mcq.
export function normalizeQuestion(raw: any): Question {
  if (raw && raw.type) return { points: 1, ...raw };
  return { id: raw?.id || uid(), type: "mcq", points: 1, q: raw?.q ?? "", opts: raw?.opts ?? [], correct: Number(raw?.correct ?? 0), why: raw?.why };
}
export function normalizeQuestions(list: any[]): Question[] {
  return (list || []).map(normalizeQuestion);
}

export const isGraded = (q: Question) => q.type !== "info";
export const maxPoints = (qs: Question[]) => qs.reduce((s, q) => s + (isGraded(q) ? q.points || 0 : 0), 0);

// Client-safe copy: strips answer keys so a taker's browser never sees them.
export function stripAnswers(q: Question): any {
  const { id, type, points } = q;
  switch (q.type) {
    case "info": return { id, type, points, title: q.title, body: q.body, code: q.code };
    case "mcq": return { id, type, points, q: q.q, opts: q.opts };
    case "tf": return { id, type, points, q: q.q };
    case "short": return { id, type, points, q: q.q };
    case "long": return { id, type, points, q: q.q, rubric: q.rubric };
    case "code": return { id, type, points, q: q.q, starter: q.starter, stdin: q.stdin };
  }
}
