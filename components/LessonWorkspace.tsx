"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CodeEditor from "./CodeEditor";
import Quiz from "./Quiz";
import type { Exercise, QuizQuestion } from "@/lib/curriculum/blocks";

async function postJSON(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

// Page order (owner's call): lesson → practice → generated practice → coding
// exercise → clean quiz at the BOTTOM (the natural end of the flow). The
// scratchpad + tutor live in the always-available side dock, not here.
export default function LessonWorkspace({
  lessonCode,
  lessonTitle,
  exercise,
  practiceQuestions,
  hasBank,
  mastered,
}: {
  lessonCode: string;
  lessonTitle: string;
  exercise: Exercise;
  practiceQuestions: QuizQuestion[]; // small formative subset (with answers, for instant feedback)
  hasBank: boolean; // full bank stays server-side — the clean quiz fetches it sans answers
  mastered: boolean;
}) {
  const router = useRouter();
  const hasExercise = Boolean(exercise && exercise.prompt);
  const hasQuiz = hasBank;

  return (
    <>
      {practiceQuestions.length > 0 && (
        <div className="panel">
          <h2>
            Practice quiz <span className="tag o">FORMATIVE · BATCH-GRADED</span>
          </h2>
          <Quiz
            questions={practiceQuestions}
            onComplete={(r) => {
              postJSON("/api/progress", { lessonCode, kind: "QUIZ_PRACTICE", passed: r.score >= 0.7, score: r.score, detail: { questions: r.detail } });
              router.refresh();
            }}
          />
        </div>
      )}

      <GeneratePanel lessonCode={lessonCode} onLogged={() => router.refresh()} />

      {hasExercise && <GradedExercise lessonCode={lessonCode} exercise={exercise} onGraded={() => router.refresh()} />}

      {hasQuiz && !mastered && (
        <CleanQuiz lessonCode={lessonCode} lessonTitle={lessonTitle} onMastered={() => router.refresh()} />
      )}
      {mastered && (
        <div className="panel" style={{ borderColor: "var(--ok)" }}>
          <h2>
            Mastered ✓ <span className="tag">CLEAN QUIZ PASSED</span>
          </h2>
          <p style={{ fontSize: 14, marginBottom: 0 }}>
            This topic is locked in. Keep practicing above any time — it can only sharpen your readiness elsewhere.
          </p>
        </div>
      )}
    </>
  );
}

/* ── Generate custom practice ──────────────────────────────────────────── */
function GeneratePanel({ lessonCode, onLogged }: { lessonCode: string; onLogged: () => void }) {
  const [request, setRequest] = useState("");
  const [gen, setGen] = useState<{ questions: QuizQuestion[]; note: string; provider?: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    setGen(null);
    const r = await postJSON("/api/ai", { feature: "generate", lessonCode, request });
    setGen(r);
    setBusy(false);
  }

  return (
    <div className="panel">
      <h2>
        Generate custom practice <span className="tag ai">AI · STRUCTURED OUTPUT</span>
      </h2>
      <p style={{ fontSize: 14 }}>Ask for a fresh set — the tutor sees your record for this topic and targets weak spots.</p>
      <div className="genrow">
        <input
          value={request}
          onChange={(e) => setRequest(e.target.value)}
          placeholder='e.g. "4 questions on infinite loops" or leave blank for auto-targeted'
          onKeyDown={(e) => e.key === "Enter" && generate()}
        />
        <button className="btn purple" onClick={generate} disabled={busy}>
          {busy ? "generating…" : "✦ Generate set"}
        </button>
      </div>
      <div className="genhint">live call → JSON-only output → parsed &amp; rendered → recorded like any attempt</div>
      {gen?.provider === "stub" && (
        <div className="offline-note">
          ⚠ <b>Offline mode</b> — no working AI key. Add a free key in <a href="/admin/settings" style={{ textDecoration: "underline" }}>Settings</a> to enable live generation.
        </div>
      )}
      {gen && gen.questions.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div className="genhint" style={{ marginBottom: 10 }}>{gen.note}</div>
          <Quiz
            questions={gen.questions}
            onComplete={(r) => {
              postJSON("/api/progress", { lessonCode, kind: "QUIZ_GENERATED", passed: r.score >= 0.7, score: r.score, detail: { questions: r.detail } });
              onLogged();
            }}
          />
        </div>
      )}
      {gen && gen.questions.length === 0 && <div className="offline-note">Couldn't build a set: {gen.note}</div>}
    </div>
  );
}

/* ── Graded coding exercise — rule-based OR AI grading (v4's two modes) ── */
function GradedExercise({ lessonCode, exercise, onGraded }: { lessonCode: string; exercise: Exercise; onGraded: () => void }) {
  const [code, setCode] = useState(exercise.starter || "// your code here\n");
  const [mode, setMode] = useState<"rule" | "ai">("rule");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<null | { passed: boolean; compiled: boolean; feedback: string; stdout: string; error?: string; meta: string }>(null);

  async function submit() {
    setBusy(true);
    setResult(null);
    const run = await postJSON("/api/run", { code, stdin: exercise.stdin || "", wrap: true });
    const grade = await postJSON("/api/ai", { feature: "grade", mode, lessonCode, code, stdout: run.stdout, compiled: run.compiled, error: run.error });
    await postJSON("/api/progress", { lessonCode, kind: "CODE_RUN", passed: grade.passed, score: grade.passed ? 1 : 0, detail: { code, stdout: run.stdout, mode } });
    setResult({ passed: grade.passed, compiled: run.compiled !== false, feedback: grade.feedback, stdout: run.stdout, error: run.error, meta: grade.meta });
    setBusy(false);
    onGraded();
  }

  return (
    <div className="panel">
      <h2>
        Coding exercise <span className="tag o">FORMATIVE · GRADED</span>
      </h2>
      <p dangerouslySetInnerHTML={{ __html: exercise.prompt }} />
      <div className="modeseg">
        <button className={mode === "rule" ? "on" : ""} onClick={() => setMode("rule")}>
          ① Output tests (rule-based)
        </button>
        <button className={mode === "ai" ? "on" : ""} onClick={() => setMode("ai")}>
          ② AI grader (logic + advice)
        </button>
      </div>
      <div className="modehint">
        {mode === "rule"
          ? "compares your program's exact output to the expected output — instant, no AI used"
          : "same output check, plus the AI reads your code and coaches you on the logic"}
      </div>
      <CodeEditor value={code} onChange={setCode} />
      <div className="runrow">
        <button className="btn green" onClick={submit} disabled={busy}>
          {busy ? "running…" : "✓ Run & grade"}
        </button>
        <button className="btn ghost" onClick={() => setCode(exercise.starter || "")}>
          Reset
        </button>
        <span className="runnote">your code runs for real either way — the pass/fail verdict is always the output test</span>
      </div>
      {result && (
        <div className="tests">
          <div className={`test ${result.passed ? "pass" : "fail"}`}>
            <span className="mark">{!result.compiled ? "DID NOT COMPILE" : result.passed ? "PASS" : "FAIL"}</span>
            <div>{!result.compiled ? result.error : result.passed ? "output matches expected" : "output does not match expected"}</div>
          </div>
          {result.compiled && (
            <div className="diff">
              <div className="box">
                <h5>Expected</h5>
                <pre>{exercise.expected || "(none)"}</pre>
              </div>
              <div className="box">
                <h5>Your program printed</h5>
                <pre>{result.stdout || "(nothing)"}</pre>
              </div>
            </div>
          )}
          <div className="aigrade">
            <span className={`verdict ${result.passed ? "ok" : "bad"}`}>{result.passed ? "✓ CORRECT" : "✗ NOT YET"}</span>
            {result.feedback}
            <span className="m">{result.meta}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Clean quiz (summative) launcher — the exam itself opens as its own
     full-screen tab (/exam/[code]) so students can focus. ── */
function CleanQuiz({
  lessonCode,
  lessonTitle,
  onMastered,
}: {
  lessonCode: string;
  lessonTitle: string;
  onMastered: () => void;
}) {
  const PASS = 0.75;
  return (
    <div className="panel" style={{ borderColor: "var(--accent-2)" }}>
      <h2>
        Ready to prove it? <span className="tag o">SUMMATIVE · LOCKED</span>
      </h2>
      <p style={{ fontSize: 14 }}>
        Everything above builds readiness. This is the one thing that sets <b>{lessonTitle}</b> to MASTERED: a clean quiz, no
        hints, pass ≥ {PASS * 100}%. Retake any time.
      </p>
      <div className="runrow">
        <a className="btn orange" href={`/exam/${lessonCode}`} target="_blank" rel="noopener" style={{ textDecoration: "none" }} onClick={() => setTimeout(onMastered, 500)}>
          🔒 Open clean quiz (new tab) → MASTERED
        </a>
        <span className="runnote">opens full-screen · refresh this page after passing to see MASTERED</span>
      </div>
    </div>
  );
}
