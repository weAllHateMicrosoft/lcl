import "server-only";
import type { Question } from "./curriculum/questions";
import { isGraded } from "./curriculum/questions";
import { runJava } from "./java/piston";
import { normalize } from "./text";

// One result per graded question. `auto=false` means a human (or AI suggestion
// the teacher confirms) must set the score — long answers, and anything the
// auto-grader couldn't settle.
export interface QResult {
  id: string;
  type: string;
  awarded: number;
  max: number;
  auto: boolean;
  correct?: boolean;
  note?: string;
}

export async function gradeQuestion(q: Question, answer: unknown): Promise<QResult> {
  const max = q.points || 0;
  const base = { id: q.id, type: q.type, max };

  switch (q.type) {
    case "info":
      return { ...base, awarded: 0, max: 0, auto: true };

    case "mcq": {
      const ok = Number(answer) === q.correct;
      return { ...base, awarded: ok ? max : 0, auto: true, correct: ok };
    }
    case "tf": {
      const ok = Boolean(answer) === q.correct;
      return { ...base, awarded: ok ? max : 0, auto: true, correct: ok };
    }
    case "short": {
      const given = String(answer ?? "");
      const norm = (s: string) => (q.caseSensitive ? s.trim() : s.trim().toLowerCase());
      const ok = q.answers.some((a) => norm(a) === norm(given));
      return { ...base, awarded: ok ? max : 0, auto: true, correct: ok };
    }
    case "code": {
      const code = String(answer ?? "");
      if (!code.trim()) return { ...base, awarded: 0, auto: true, correct: false, note: "no code submitted" };
      const run = await runJava(code, q.stdin || "", { wrapBeginner: true });
      if (run.compiled === false) return { ...base, awarded: 0, auto: true, correct: false, note: "did not compile" };
      const ok = normalize(run.stdout) === normalize(q.expected || "");
      return { ...base, awarded: ok ? max : 0, auto: true, correct: ok, note: ok ? "output matches" : `output: ${run.stdout.slice(0, 80)}` };
    }
    case "long":
      // Needs a human decision (teacher can pull an AI suggestion in the UI).
      return { ...base, awarded: 0, auto: false, note: "awaiting marking" };
  }
}

export async function gradeSubmission(questions: Question[], answers: Record<string, unknown>) {
  const results: QResult[] = [];
  for (const q of questions) {
    if (!isGraded(q)) continue;
    results.push(await gradeQuestion(q, answers[q.id]));
  }
  const autoScore = results.reduce((s, r) => s + r.awarded, 0);
  const maxScore = results.reduce((s, r) => s + r.max, 0);
  const needsManual = results.some((r) => !r.auto);
  return { results, autoScore, maxScore, needsManual };
}
