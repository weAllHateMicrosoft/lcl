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

export default function LessonWorkspace({
  lessonCode,
  exercise,
  quizBank,
}: {
  lessonCode: string;
  exercise: Exercise;
  quizBank: QuizQuestion[];
}) {
  const router = useRouter();
  return (
    <>
      <Scratchpad />
      <GradedExercise lessonCode={lessonCode} exercise={exercise} onGraded={() => router.refresh()} />
      <PracticePanel lessonCode={lessonCode} quizBank={quizBank} />
      <Tutor lessonCode={lessonCode} />
      <SummativeQuiz lessonCode={lessonCode} quizBank={quizBank} onMastered={() => router.refresh()} />
    </>
  );
}

// ─── Scratchpad ────────────────────────────────────────────────────────────
function Scratchpad() {
  const [code, setCode] = useState('String name = input("Your name? ");\nSystem.out.println("Hi, " + name + "!");');
  const [stdin, setStdin] = useState("Ada");
  const [out, setOut] = useState("");
  const [err, setErr] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setOut("compiling & running…");
    setErr(false);
    const r = await postJSON("/api/run", { code, stdin, wrap: true });
    setErr(r.compiled === false);
    setOut(r.compiled === false ? r.error : r.stdout || "(no output)");
    setBusy(false);
  }

  return (
    <div className="panel">
      <h3>▶ Scratchpad</h3>
      <CodeEditor value={code} onChange={setCode} />
      <label className="field" style={{ marginBottom: 8 }}>
        <span className="l">Standard input <span className="hint">(fed to input() calls)</span></span>
        <input className="f" value={stdin} onChange={(e) => setStdin(e.target.value)} />
      </label>
      <div className="row-btns">
        <button className="btn primary" onClick={run} disabled={busy}>
          Run
        </button>
      </div>
      {out && <div className={`output ${err ? "err" : ""}`}>{out}</div>}
    </div>
  );
}

// ─── Graded coding exercise ────────────────────────────────────────────────
function GradedExercise({ lessonCode, exercise, onGraded }: { lessonCode: string; exercise: Exercise; onGraded: () => void }) {
  const [code, setCode] = useState(exercise.starter || "");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<null | { passed: boolean; feedback: string; stdout: string; error?: string; meta: string; compiled: boolean }>(null);

  async function submit() {
    setBusy(true);
    setResult(null);
    const run = await postJSON("/api/run", { code, stdin: exercise.stdin || "", wrap: true });
    const grade = await postJSON("/api/ai", {
      feature: "grade",
      lessonCode,
      code,
      stdout: run.stdout,
      compiled: run.compiled,
      error: run.error,
    });
    await postJSON("/api/progress", { lessonCode, kind: "CODE_RUN", passed: grade.passed, score: grade.passed ? 1 : 0, detail: { code, stdout: run.stdout } });
    setResult({ passed: grade.passed, feedback: grade.feedback, stdout: run.stdout, error: run.error, meta: grade.meta, compiled: run.compiled !== false });
    setBusy(false);
    onGraded();
  }

  return (
    <div className="panel">
      <h3>✎ Graded exercise</h3>
      <p style={{ marginTop: 0 }} dangerouslySetInnerHTML={{ __html: exercise.prompt }} />
      <CodeEditor value={code} onChange={setCode} />
      <div className="row-btns" style={{ marginTop: 10 }}>
        <button className="btn primary" onClick={submit} disabled={busy}>
          {busy ? "running…" : "✓ Run & grade"}
        </button>
      </div>
      {result && (
        <>
          <div className="output" style={{ background: "var(--bg)", color: "var(--ink)", border: "1px solid var(--line)" }}>
            <span className={`verdict ${result.passed ? "ok" : "bad"}`}>
              {!result.compiled ? "✗ DID NOT COMPILE" : result.passed ? "✓ PASS" : "✗ NOT YET"}
            </span>
            <div style={{ marginTop: 6, fontFamily: "var(--sans)", fontSize: 14 }}>{result.feedback}</div>
          </div>
          <div className="meta">
            expected: <code>{exercise.expected}</code> · got: <code>{result.compiled ? result.stdout || "(nothing)" : result.error}</code>
          </div>
          <div className="meta">{result.meta}</div>
          {result.passed && (
            <div className="meta">Counts toward readiness — only the clean quiz flips this lesson to MASTERED.</div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Practice: static bank + AI-generated ──────────────────────────────────
function PracticePanel({ lessonCode, quizBank }: { lessonCode: string; quizBank: QuizQuestion[] }) {
  const [request, setRequest] = useState("");
  const [gen, setGen] = useState<{ questions: QuizQuestion[]; note: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function generate() {
    setBusy(true);
    setGen(null);
    const r = await postJSON("/api/ai", { feature: "generate", lessonCode, request });
    setGen(r);
    setBusy(false);
  }

  function log(kind: "QUIZ_PRACTICE" | "QUIZ_GENERATED", r: { correct: number; total: number; score: number }) {
    postJSON("/api/progress", { lessonCode, kind, passed: r.score >= 0.7, score: r.score });
  }

  return (
    <div className="panel">
      <h3>🎯 Practice</h3>
      <Quiz questions={quizBank.slice(0, 3)} onComplete={(r) => log("QUIZ_PRACTICE", r)} />
      <hr style={{ border: "none", borderTop: "1px solid var(--line)", margin: "18px 0" }} />
      <div className="row-btns">
        <input
          className="f"
          style={{ flex: 1 }}
          placeholder="Ask for a targeted set (or leave blank to auto-target weak spots)"
          value={request}
          onChange={(e) => setRequest(e.target.value)}
        />
        <button className="btn" onClick={generate} disabled={busy}>
          {busy ? "generating…" : "Generate"}
        </button>
      </div>
      {gen && (
        <div style={{ marginTop: 14 }}>
          <div className="meta">{gen.note}</div>
          <Quiz questions={gen.questions} onComplete={(r) => log("QUIZ_GENERATED", r)} />
        </div>
      )}
    </div>
  );
}

// ─── AI tutor ──────────────────────────────────────────────────────────────
function Tutor({ lessonCode }: { lessonCode: string }) {
  const [msgs, setMsgs] = useState<{ role: "u" | "a"; text: string; meta?: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(message: string) {
    if (!message.trim()) return;
    setMsgs((m) => [...m, { role: "u", text: message }]);
    setInput("");
    setBusy(true);
    const r = await postJSON("/api/ai", { feature: "tutor", lessonCode, message });
    setMsgs((m) => [...m, { role: "a", text: r.text, meta: r.meta }]);
    setBusy(false);
  }

  return (
    <div className="panel">
      <h3>💬 AI tutor</h3>
      {msgs.length > 0 && (
        <div className="msgs">
          {msgs.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              {m.role === "a" && <span className="who">TUTOR</span>}
              {m.text}
              {m.meta && <div className="meta">{m.meta}</div>}
            </div>
          ))}
        </div>
      )}
      <div className="ask">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask(input)}
          placeholder="Ask the tutor… (it gives hints, never full solutions)"
          disabled={busy}
        />
        <button className="btn" onClick={() => ask("I'm stuck — a hint please?")} disabled={busy}>
          Hint
        </button>
        <button className="btn primary" onClick={() => ask(input)} disabled={busy}>
          Ask
        </button>
      </div>
    </div>
  );
}

// ─── Summative "clean" quiz — the only path to MASTERED ─────────────────────
function SummativeQuiz({ lessonCode, quizBank, onMastered }: { lessonCode: string; quizBank: QuizQuestion[]; onMastered: () => void }) {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<null | { passed: boolean; pct: number }>(null);
  const PASS = 0.75;

  async function complete(r: { correct: number; total: number; score: number }) {
    const passed = r.score >= PASS;
    await postJSON("/api/progress", { lessonCode, kind: "QUIZ_SUMMATIVE", passed, score: r.score, detail: { summative: true } });
    setResult({ passed, pct: Math.round(r.score * 100) });
    if (passed) onMastered();
  }

  return (
    <div className="panel" style={{ borderColor: "var(--violet)" }}>
      <h3>🔒 Clean quiz (summative)</h3>
      <p style={{ marginTop: 0, fontSize: 13, color: "var(--muted)" }}>
        Locked-down check. Passing at {PASS * 100}% is the <b>only</b> thing that sets this lesson to MASTERED.
      </p>
      {!open ? (
        <button className="btn primary" onClick={() => { setOpen(true); setResult(null); }}>
          Start clean quiz
        </button>
      ) : (
        <>
          <Quiz questions={quizBank} locked onComplete={complete} />
          {result && (
            <div className={`verdict ${result.passed ? "ok" : "bad"}`} style={{ marginTop: 10 }}>
              {result.passed ? `✓ ${result.pct}% — MASTERED. Sidebar and dashboard update now.` : `✗ ${result.pct}% — below ${PASS * 100}%. Logged; retake anytime.`}
            </div>
          )}
        </>
      )}
    </div>
  );
}
