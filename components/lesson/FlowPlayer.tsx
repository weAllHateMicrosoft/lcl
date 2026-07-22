"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// The interactive lesson player: one step per screen, do-first, near-zero text.
// Kinds: run (press ▶, watch), tweak (change it, make it yours), predict (tap
// what it prints — graded server-side), fix (broken → target), arrange (tap
// lines into order), write (build it from scratch). Help ladder per step:
// fail once → authored 💡 hint; fail twice → 🤖 tutor with full step context.

type Step = {
  id: string;
  kind: "run" | "tweak" | "predict" | "fix" | "arrange" | "write";
  instruction: string;
  code?: string;
  opts?: string[];
  target?: string; // fix/write/arrange: expected stdout · tweak: the ORIGINAL output to differ from
  lines?: string[];
  hint?: string;
  after?: string;
};

type RunOut = { compiled: boolean; stdout: string; error: string };

const norm = (s: string) => (s || "").replace(/\r\n/g, "\n").trimEnd();

export default function FlowPlayer({ lessonCode, lessonTitle, nextHref }: { lessonCode: string; lessonTitle: string; nextHref?: string | null }) {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [i, setI] = useState(0);
  const [firstTry, setFirstTry] = useState(0);
  const attemptsRef = useRef<Record<string, number>>({});

  useEffect(() => {
    fetch(`/api/lesson/flow?lessonCode=${encodeURIComponent(lessonCode)}`)
      .then((r) => r.json())
      .then((d) => setSteps(d.steps || []));
  }, [lessonCode]);

  if (!steps) return <div className="panel" style={{ color: "var(--muted)" }}>Loading…</div>;
  if (!steps.length) return null;

  const done = i >= steps.length;
  const step = done ? null : steps[i];

  function completed(stepId: string, wasFirstTry: boolean) {
    if (wasFirstTry) setFirstTry((n) => n + 1);
    const attempts = attemptsRef.current[stepId] || 1;
    fetch("/api/lesson/flow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete", lessonCode, stepId, attempts }),
    }).catch(() => {});
  }

  return (
    <div className="flowplay">
      <div className="flowbar">
        <span className="flowdots">
          {steps.map((s, j) => (
            <span key={s.id} className={j < i ? "d on" : j === i ? "d now" : "d"} />
          ))}
        </span>
        <span className="meta" style={{ margin: 0 }}>{done ? "done!" : `${i + 1} / ${steps.length}`}</span>
        <span style={{ flex: 1 }} />
        <Link href={`/exam/${lessonCode}`} className="meta" style={{ margin: 0, textDecoration: "underline dotted" }} title="Skip the steps — pass the clean quiz and you're done.">
          ⚡ know this? prove it
        </Link>
      </div>

      {done ? (
        <FlowDone lessonCode={lessonCode} total={steps.length} firstTry={firstTry} nextHref={nextHref} />
      ) : (
        <StepView
          key={step!.id}
          step={step!}
          lessonCode={lessonCode}
          lessonTitle={lessonTitle}
          onAttempt={(id) => (attemptsRef.current[id] = (attemptsRef.current[id] || 0) + 1)}
          attemptsOf={(id) => attemptsRef.current[id] || 0}
          onDone={(wasFirstTry) => {
            completed(step!.id, wasFirstTry);
            setI(i + 1);
          }}
          onSkip={() => setI(i + 1)}
        />
      )}
    </div>
  );
}

function StepView({ step, lessonCode, lessonTitle, onDone, onSkip, onAttempt, attemptsOf }: {
  step: Step;
  lessonCode: string;
  lessonTitle: string;
  onDone: (firstTry: boolean) => void;
  onSkip: () => void;
  onAttempt: (id: string) => void;
  attemptsOf: (id: string) => number;
}) {
  const [code, setCode] = useState(step.code || "");
  const [out, setOut] = useState<RunOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [won, setWon] = useState(false);
  const [reveal, setReveal] = useState<{ correct: boolean; correctIndex: number; why: string; chosen: number } | null>(null);
  const [picked, setPicked] = useState<string[]>([]); // arrange
  const [hintOpen, setHintOpen] = useState(false);
  const [aiHint, setAiHint] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const fails = attemptsOf(step.id);

  const assembled = step.kind === "arrange" ? picked.join("\n") : code;

  async function run() {
    onAttempt(step.id);
    setBusy(true);
    setOut(null);
    const r: RunOut = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: assembled, wrap: true, lessonCode }),
    }).then((x) => x.json());
    setBusy(false);
    setOut(r);

    const ok =
      step.kind === "run" ? r.compiled && !r.error
      : step.kind === "tweak" ? r.compiled && !r.error && norm(r.stdout) !== norm(step.target || "") && norm(r.stdout).length > 0
      : r.compiled && !r.error && norm(r.stdout) === norm(step.target || "");
    if (ok) {
      setWon(true);
      // let them SEE the success beat before advancing
    }
  }

  async function answer(choice: number) {
    if (reveal) return;
    onAttempt(step.id);
    const d = await fetch("/api/lesson/flow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "answer", lessonCode, stepId: step.id, choice, attempt: 1 }),
    }).then((r) => r.json());
    setReveal({ ...d, chosen: choice });
  }

  async function askTutor() {
    setAiBusy(true);
    const msg =
      `I'm on an interactive step in this lesson. The task: ${step.instruction}` +
      (step.target ? `\nTarget output:\n${step.target}` : "") +
      `\nMy code:\n${assembled}` +
      (out ? `\nWhat happened: ${out.compiled ? out.error ? `runtime error: ${out.error}` : `it printed:\n${out.stdout}` : `compile error: ${out.error}`}` : "\nI haven't run it yet.") +
      `\nGive me ONE small hint. Don't solve it for me.`;
    const d = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feature: "tutor", lessonCode, message: msg }),
    }).then((r) => r.json());
    setAiHint(d.text || d.error || "The tutor is unavailable right now.");
    setAiBusy(false);
  }

  const runnable = step.kind !== "predict";
  const editable = step.kind === "tweak" || step.kind === "fix" || step.kind === "write";

  return (
    <div className={`panel flowstep ${won ? "won" : ""}`}>
      <div className="flowq">{step.instruction}</div>

      {/* code surface */}
      {step.kind === "arrange" ? (
        <div className="flowarrange">
          <div className="pool">
            {(step.lines || []).filter((l) => !picked.includes(l)).map((l) => (
              <button key={l} className="linebtn" onClick={() => { setPicked([...picked, l]); setOut(null); }}>{l}</button>
            ))}
          </div>
          <div className="built">
            {picked.length === 0 && <span className="meta" style={{ margin: 0 }}>tap the lines above, in order</span>}
            {picked.map((l, j) => (
              <button key={l} className="linebtn placed" title="tap to remove" onClick={() => { setPicked(picked.filter((x) => x !== l)); setOut(null); setWon(false); }}>
                <span className="n">{j + 1}</span> {l}
              </button>
            ))}
          </div>
        </div>
      ) : editable ? (
        <textarea
          className="flowcode"
          rows={Math.max(3, (code.match(/\n/g)?.length || 0) + 2)}
          value={code}
          spellCheck={false}
          onChange={(e) => { setCode(e.target.value); setWon(false); }}
        />
      ) : step.code ? (
        <pre className="flowcode ro">{step.code}</pre>
      ) : null}

      {/* target */}
      {step.target && step.kind !== "tweak" && step.kind !== "run" && (
        <div className="flowtarget">
          <div className="lbl">TARGET OUTPUT</div>
          <pre>{step.target}</pre>
        </div>
      )}

      {/* predict options */}
      {step.kind === "predict" && (
        <div className="flowopts">
          {(step.opts || []).map((o, j) => {
            const cls = !reveal ? "" : j === reveal.correctIndex ? "right" : j === reveal.chosen ? "wrong" : "dim";
            return (
              <button key={j} className={`optbtn ${cls}`} disabled={!!reveal} onClick={() => answer(j)}>
                <pre style={{ margin: 0, fontFamily: "inherit", whiteSpace: "pre-wrap" }}>{o}</pre>
              </button>
            );
          })}
        </div>
      )}

      {/* run + output */}
      {runnable && (
        <div className="flowrun">
          <button className="btn green" style={{ fontSize: 15, padding: "10px 26px" }} disabled={busy || (step.kind === "arrange" && picked.length !== (step.lines || []).length)} onClick={run}>
            {busy ? "running…" : "▶ Run"}
          </button>
          {step.kind === "arrange" && picked.length > 0 && !won && (
            <button className="btn ghost" onClick={() => { setPicked([]); setOut(null); }}>↺ reset</button>
          )}
        </div>
      )}
      {out && (
        <div className={`flowout ${out.compiled && !out.error ? "" : "err"}`}>
          <div className="lbl">{out.compiled ? (out.error ? "RUNTIME ERROR" : "OUTPUT") : "COMPILE ERROR — read it, it tells you where"}</div>
          <pre>{out.compiled ? (out.error || out.stdout || "(nothing printed)") : out.error}</pre>
        </div>
      )}

      {/* reveal / success beats */}
      {reveal && (
        <div className={`flowwhy ${reveal.correct ? "yes" : "no"}`}>
          <b>{reveal.correct ? "✓ exactly." : "not quite —"}</b> {reveal.why}
        </div>
      )}
      {won && step.after && <div className="flowwhy yes"><b>✓</b> {step.after}</div>}
      {won && !step.after && <div className="flowwhy yes"><b>✓ nailed it.</b></div>}

      {/* help ladder — appears only when struggling */}
      {!won && !reveal && runnable && fails >= 1 && (
        <div className="flowhelp">
          {step.hint && !hintOpen && <button className="btn ghost" onClick={() => setHintOpen(true)}>💡 hint</button>}
          {hintOpen && <span className="hinttext">💡 {step.hint}</span>}
          {fails >= 2 && !aiHint && (
            <button className="btn purple" disabled={aiBusy} onClick={askTutor}>{aiBusy ? "…" : "🤖 I'm stuck"}</button>
          )}
          {aiHint && <span className="hinttext">🤖 {aiHint}</span>}
        </div>
      )}

      {/* advance */}
      <div className="flownext">
        {(won || reveal) ? (
          <button className="btn green" style={{ fontSize: 15, padding: "10px 30px" }} onClick={() => onDone((won || reveal?.correct === true) && fails <= 1)} autoFocus>
            Next →
          </button>
        ) : (
          <button className="skiplink" onClick={onSkip} title="Skip this step (it won't count)">skip ›</button>
        )}
      </div>
    </div>
  );
}

function FlowDone({ lessonCode, total, firstTry, nextHref }: { lessonCode: string; total: number; firstTry: number; nextHref?: string | null }) {
  return (
    <div className="panel flowstep won" style={{ textAlign: "center" }}>
      <div style={{ fontSize: 40 }}>🎉</div>
      <h2 style={{ fontFamily: "var(--serif)", margin: "6px 0" }}>Lesson complete</h2>
      <p className="meta">{total} steps · {firstTry} first-try</p>
      <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap", marginTop: 10 }}>
        <Link href={`/exam/${lessonCode}`} className="btn green" style={{ textDecoration: "none", fontSize: 15, padding: "10px 22px" }}>
          🔒 Prove it — clean quiz
        </Link>
        {nextHref && (
          <Link href={nextHref} className="btn ghost" style={{ textDecoration: "none", fontSize: 15, padding: "10px 22px" }}>
            Next lesson →
          </Link>
        )}
      </div>
      <p className="meta" style={{ marginTop: 10 }}>The clean quiz is what makes it official — steps warm you up, the quiz proves it.</p>
    </div>
  );
}
