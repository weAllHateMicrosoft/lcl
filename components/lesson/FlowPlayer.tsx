"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// The interactive lesson player — one step per screen, do-first, near-zero
// text. 14 step kinds (see lib/curriculum/flow.ts, the canonical spec):
//   run · tweak · note · predict · spot · trace · fix · write · arrange ·
//   fill · bucket · match · explain · branch
// All answer keys live server-side; grading happens at /api/lesson/flow.
// Help ladder on doing-steps: fail once → authored 💡 hint; twice → 🤖 tutor
// called with the step's code/target/actual-output as context.

type Step = {
  id: string;
  kind: string;
  instruction: string;
  hint?: string;
  after?: string;
  code?: string;
  target?: string;
  opts?: string[];
  questions?: { prompt: string; opts: string[] }[];
  lines?: string[];
  count?: number;
  blanks?: { chips: string[] }[];
  buckets?: string[];
  items?: { text: string }[];
  lefts?: string[];
  rights?: string[];
  prompt?: string;
  options?: { label: string; goto: string }[];
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
    fetch("/api/lesson/flow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete", lessonCode, stepId, attempts: attemptsRef.current[stepId] || 1 }),
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
          onAttempt={(id) => (attemptsRef.current[id] = (attemptsRef.current[id] || 0) + 1)}
          attemptsOf={(id) => attemptsRef.current[id] || 0}
          onDone={(wasFirstTry) => { completed(step!.id, wasFirstTry); setI(i + 1); }}
          onSkip={() => setI(i + 1)}
          onGoto={(id) => {
            const j = steps.findIndex((s) => s.id === id);
            setI(j >= 0 ? j : i + 1);
          }}
        />
      )}
    </div>
  );
}

function StepView({ step, lessonCode, onDone, onSkip, onGoto, onAttempt, attemptsOf }: {
  step: Step;
  lessonCode: string;
  onDone: (firstTry: boolean) => void;
  onSkip: () => void;
  onGoto: (id: string) => void;
  onAttempt: (id: string) => void;
  attemptsOf: (id: string) => number;
}) {
  const [code, setCode] = useState(step.code || "");
  const [out, setOut] = useState<RunOut | null>(null);
  const [busy, setBusy] = useState(false);
  const [won, setWon] = useState(false);
  const [reveal, setReveal] = useState<{ correct: boolean; correctIndex?: number; why?: string; chosen?: number } | null>(null);
  const [picked, setPicked] = useState<string[]>([]); // arrange
  const [traceIdx, setTraceIdx] = useState(0); // trace progress
  const [traceReveal, setTraceReveal] = useState<{ correct: boolean; correctIndex: number; why?: string; chosen: number } | null>(null);
  const [fillPick, setFillPick] = useState<number[]>([]); // fill: chip index per blank
  const [verdicts, setVerdicts] = useState<boolean[] | null>(null); // fill/bucket/match
  const [serverAnswers, setServerAnswers] = useState<number[] | null>(null);
  const [assign, setAssign] = useState<number[]>([]); // bucket: bucket idx per item
  const [pairsMade, setPairsMade] = useState<[number, string][]>([]); // match
  const [leftSel, setLeftSel] = useState<number | null>(null);
  const [explainText, setExplainText] = useState("");
  const [explainReply, setExplainReply] = useState("");
  const [hintOpen, setHintOpen] = useState(false);
  const [aiHint, setAiHint] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const fails = attemptsOf(step.id);

  const post = (payload: Record<string, unknown>) =>
    fetch("/api/lesson/flow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonCode, stepId: step.id, ...payload }),
    }).then((r) => r.json());

  // ── runnable kinds ──
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
    if (ok) setWon(true);
  }

  // ── graded taps ──
  async function answer(choice: number) {
    if (reveal) return;
    onAttempt(step.id);
    const d = await post({ action: "answer", choice, attempt: 1 });
    setReveal({ ...d, chosen: choice });
  }
  async function traceAnswer(choice: number) {
    if (traceReveal) return;
    if (traceIdx === 0) onAttempt(step.id);
    const d = await post({ action: "trace", qIndex: traceIdx, choice, attempt: traceIdx === 0 ? 1 : 2 });
    setTraceReveal({ ...d, chosen: choice });
  }
  function traceNext() {
    setTraceReveal(null);
    if (traceIdx + 1 >= (step.questions || []).length) setWon(true);
    else setTraceIdx(traceIdx + 1);
  }
  async function checkFill() {
    onAttempt(step.id);
    const d = await post({ action: "fill", choices: fillPick, attempt: fails + 1 });
    setVerdicts(d.verdicts || []);
    setServerAnswers(d.answers || null);
    if (d.correct) { setReveal({ correct: true, why: d.why }); setWon(true); }
  }
  async function checkBucket() {
    onAttempt(step.id);
    const d = await post({ action: "bucket", assignments: assign, attempt: fails + 1 });
    setVerdicts(d.verdicts || []);
    setServerAnswers(d.answers || null);
    if (d.correct) { setReveal({ correct: true, why: d.why }); setWon(true); }
  }
  async function checkMatch() {
    onAttempt(step.id);
    const d = await post({ action: "match", pairs: pairsMade, attempt: fails + 1 });
    setVerdicts(d.verdicts || []);
    if (d.correct) { setReveal({ correct: true, why: d.why }); setWon(true); }
    else setPairsMade(pairsMade.filter((_, j) => d.verdicts?.[j])); // keep the right ones, retry the rest
  }
  async function sendExplain() {
    onAttempt(step.id);
    setBusy(true);
    const d = await post({ action: "explain", text: explainText, attempt: fails + 1 });
    setBusy(false);
    setExplainReply(d.reply || d.error || "");
    if (d.correct) setWon(true);
  }

  async function askTutor() {
    setAiBusy(true);
    const msg =
      `I'm on an interactive step in this lesson. The task: ${step.instruction}` +
      (step.target ? `\nTarget output:\n${step.target}` : "") +
      (assembled ? `\nMy code:\n${assembled}` : "") +
      (out ? `\nWhat happened: ${out.compiled ? out.error ? `runtime error: ${out.error}` : `it printed:\n${out.stdout}` : `compile error: ${out.error}`}` : "") +
      `\nGive me ONE small hint. Don't solve it for me.`;
    const d = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feature: "tutor", lessonCode, message: msg }),
    }).then((r) => r.json());
    setAiHint(d.text || d.error || "The tutor is unavailable right now.");
    setAiBusy(false);
  }

  const runnable = ["run", "tweak", "fix", "write", "arrange"].includes(step.kind);
  const editable = ["tweak", "fix", "write"].includes(step.kind);
  const codeLines = (step.code || "").split("\n");
  const advanceReady = won || (reveal && step.kind !== "fill" && step.kind !== "bucket");

  return (
    <div className={`panel flowstep ${won ? "won" : ""}`}>
      <div className="flowq">{step.instruction}</div>

      {/* ── code surface ── */}
      {step.kind === "spot" ? (
        <div className="flowspot">
          {codeLines.map((l, j) => {
            const cls = !reveal ? "" : j === reveal.correctIndex ? "right" : j === reveal.chosen ? "wrong" : "dim";
            return (
              <button key={j} className={`spotline ${cls}`} disabled={!!reveal} onClick={() => answer(j)}>
                <span className="ln">{j + 1}</span>
                <pre>{l || " "}</pre>
              </button>
            );
          })}
        </div>
      ) : step.kind === "arrange" ? (
        <div className="flowarrange">
          <div className="pool">
            {(step.lines || []).filter((l) => !picked.includes(l)).map((l) => (
              <button key={l} className="linebtn" onClick={() => { setPicked([...picked, l]); setOut(null); }}>{l}</button>
            ))}
          </div>
          <div className="built">
            {picked.length === 0 && <span className="meta" style={{ margin: 0 }}>tap the lines above, in order — some may be decoys</span>}
            {picked.map((l, j) => (
              <button key={l} className="linebtn placed" title="tap to remove" onClick={() => { setPicked(picked.filter((x) => x !== l)); setOut(null); setWon(false); }}>
                <span className="n">{j + 1}</span> {l}
              </button>
            ))}
          </div>
        </div>
      ) : step.kind === "fill" ? (
        <FillSurface step={step} fillPick={fillPick} setFillPick={(p) => { setFillPick(p); setVerdicts(null); }} verdicts={verdicts} serverAnswers={serverAnswers} />
      ) : editable ? (
        <textarea className="flowcode" rows={Math.max(3, (code.match(/\n/g)?.length || 0) + 2)} value={code} spellCheck={false} onChange={(e) => { setCode(e.target.value); setWon(false); }} />
      ) : step.code ? (
        <pre className="flowcode ro">{step.code}</pre>
      ) : null}

      {/* ── target ── */}
      {step.target && !["tweak", "run", "predict", "spot", "trace"].includes(step.kind) && (
        <div className="flowtarget">
          <div className="lbl">TARGET OUTPUT</div>
          <pre>{step.target}</pre>
        </div>
      )}

      {/* ── kind-specific interaction ── */}
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

      {step.kind === "trace" && !won && (
        <div className="flowtracer">
          <div className="meta" style={{ margin: "8px 0 4px" }}>checkpoint {traceIdx + 1} / {(step.questions || []).length}</div>
          <div className="flowq" style={{ fontSize: 16 }}>{step.questions?.[traceIdx]?.prompt}</div>
          <div className="flowopts">
            {(step.questions?.[traceIdx]?.opts || []).map((o, j) => {
              const cls = !traceReveal ? "" : j === traceReveal.correctIndex ? "right" : j === traceReveal.chosen ? "wrong" : "dim";
              return <button key={j} className={`optbtn ${cls}`} disabled={!!traceReveal} onClick={() => traceAnswer(j)}>{o}</button>;
            })}
          </div>
          {traceReveal && (
            <div className={`flowwhy ${traceReveal.correct ? "yes" : "no"}`}>
              <b>{traceReveal.correct ? "✓" : "not quite —"}</b> {traceReveal.why || ""}
              <button className="btn ghost" style={{ marginLeft: 10, padding: "3px 12px" }} onClick={traceNext}>
                {traceIdx + 1 >= (step.questions || []).length ? "finish" : "next checkpoint →"}
              </button>
            </div>
          )}
        </div>
      )}

      {step.kind === "fill" && !won && (
        <button className="btn green" style={{ marginTop: 10 }} disabled={(step.blanks || []).some((_, bi) => fillPick[bi] === undefined)} onClick={checkFill}>
          Check
        </button>
      )}

      {step.kind === "bucket" && (
        <div className="flowbuckets">
          {(step.items || []).map((it, i2) => (
            <div key={i2} className={`bucketrow ${verdicts ? (verdicts[i2] ? "right" : "wrong") : ""}`}>
              <span className="itext">{it.text}</span>
              <span className="bchips">
                {(step.buckets || []).map((b, bi) => (
                  <button
                    key={bi}
                    className={`bchip ${assign[i2] === bi ? "on" : ""} ${verdicts && !verdicts[i2] && serverAnswers && serverAnswers[i2] === bi ? "hintright" : ""}`}
                    onClick={() => { const a = [...assign]; a[i2] = bi; setAssign(a); setVerdicts(null); }}
                  >
                    {b}
                  </button>
                ))}
              </span>
            </div>
          ))}
          {!won && (
            <button className="btn green" style={{ marginTop: 10 }} disabled={(step.items || []).some((_, i2) => assign[i2] === undefined)} onClick={checkBucket}>
              Check
            </button>
          )}
        </div>
      )}

      {step.kind === "match" && (
        <div className="flowmatch">
          <div className="mcol">
            {(step.lefts || []).map((l, li) => {
              const pairedWith = pairsMade.find((p) => p[0] === li)?.[1];
              return (
                <button key={li} className={`mchip ${leftSel === li ? "sel" : ""} ${pairedWith ? "paired" : ""}`} onClick={() => { setLeftSel(li); }}>
                  {l} {pairedWith ? `↔ ${pairedWith}` : ""}
                </button>
              );
            })}
          </div>
          <div className="mcol">
            {(step.rights || []).filter((r) => !pairsMade.some((p) => p[1] === r)).map((r) => (
              <button key={r} className="mchip" disabled={leftSel === null} onClick={() => {
                if (leftSel === null) return;
                setPairsMade([...pairsMade.filter((p) => p[0] !== leftSel), [leftSel, r]]);
                setLeftSel(null);
                setVerdicts(null);
              }}>
                {r}
              </button>
            ))}
          </div>
          {!won && (
            <button className="btn green" style={{ marginTop: 10 }} disabled={pairsMade.length !== (step.lefts || []).length} onClick={checkMatch}>
              Check
            </button>
          )}
        </div>
      )}

      {step.kind === "explain" && (
        <div className="flowexplain">
          {step.prompt && <p style={{ margin: "4px 0 8px", fontSize: 15 }}>{step.prompt}</p>}
          <textarea className="f" rows={2} value={explainText} placeholder="one or two sentences, your own words…" onChange={(e) => setExplainText(e.target.value)} disabled={won} />
          {!won && (
            <div className="runrow" style={{ marginTop: 8 }}>
              <button className="btn purple" disabled={busy || !explainText.trim()} onClick={sendExplain}>{busy ? "reading…" : "✦ Convince me"}</button>
              {fails >= 2 && <button className="skiplink" onClick={onSkip}>move on ›</button>}
            </div>
          )}
          {explainReply && <div className={`flowwhy ${won ? "yes" : "no"}`}>{won ? "✓ " : ""}{explainReply}</div>}
        </div>
      )}

      {step.kind === "branch" && (
        <div className="flowopts">
          {(step.options || []).map((o, j) => (
            <button key={j} className="optbtn" onClick={() => onGoto(o.goto)}>{o.label}</button>
          ))}
        </div>
      )}

      {step.kind === "note" && <div style={{ marginTop: 4 }} />}

      {/* ── run + output ── */}
      {runnable && (
        <div className="flowrun">
          <button className="btn green" style={{ fontSize: 15, padding: "10px 26px" }} disabled={busy || (step.kind === "arrange" && picked.length !== (step.count ?? (step.lines || []).length))} onClick={run}>
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

      {/* ── reveal / success beats ── */}
      {reveal && reveal.why !== undefined && reveal.why !== "" && (
        <div className={`flowwhy ${reveal.correct ? "yes" : "no"}`}>
          <b>{reveal.correct ? "✓ exactly." : "not quite —"}</b> {reveal.why}
        </div>
      )}
      {won && step.after && <div className="flowwhy yes"><b>✓</b> {step.after}</div>}
      {won && !step.after && !reveal?.why && step.kind !== "note" && <div className="flowwhy yes"><b>✓ nailed it.</b></div>}

      {/* ── help ladder ── */}
      {!won && !reveal && (runnable || step.kind === "fill" || step.kind === "bucket") && fails >= 1 && (
        <div className="flowhelp">
          {step.hint && !hintOpen && <button className="btn ghost" onClick={() => setHintOpen(true)}>💡 hint</button>}
          {hintOpen && <span className="hinttext">💡 {step.hint}</span>}
          {fails >= 2 && !aiHint && runnable && (
            <button className="btn purple" disabled={aiBusy} onClick={askTutor}>{aiBusy ? "…" : "🤖 I'm stuck"}</button>
          )}
          {aiHint && <span className="hinttext">🤖 {aiHint}</span>}
        </div>
      )}

      {/* ── advance ── */}
      <div className="flownext">
        {step.kind === "note" ? (
          <button className="btn green" style={{ fontSize: 15, padding: "10px 30px" }} onClick={() => onDone(true)} autoFocus>Next →</button>
        ) : step.kind === "branch" ? (
          <span />
        ) : advanceReady ? (
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

// fill: code with ⟦n⟧ markers rendered inline as the currently-picked chip
function FillSurface({ step, fillPick, setFillPick, verdicts, serverAnswers }: {
  step: Step;
  fillPick: number[];
  setFillPick: (p: number[]) => void;
  verdicts: boolean[] | null;
  serverAnswers: number[] | null;
}) {
  const parts = (step.code || "").split(/(⟦\d+⟧)/g);
  return (
    <div>
      <pre className="flowcode ro" style={{ whiteSpace: "pre-wrap" }}>
        {parts.map((p, j) => {
          const m = p.match(/^⟦(\d+)⟧$/);
          if (!m) return <span key={j}>{p}</span>;
          const bi = Number(m[1]) - 1;
          const picked = fillPick[bi];
          const v = verdicts?.[bi];
          return (
            <span key={j} className={`fillslot ${picked === undefined ? "" : v === undefined ? "set" : v ? "right" : "wrong"}`}>
              {picked === undefined ? `?${bi + 1}` : step.blanks?.[bi]?.chips[picked]}
            </span>
          );
        })}
      </pre>
      {(step.blanks || []).map((b, bi) => (
        <div key={bi} className="fillrow">
          <span className="meta" style={{ margin: 0 }}>?{bi + 1}</span>
          {b.chips.map((c, ci) => (
            <button
              key={ci}
              className={`bchip ${fillPick[bi] === ci ? "on" : ""} ${verdicts && !verdicts[bi] && serverAnswers && serverAnswers[bi] === ci ? "hintright" : ""}`}
              onClick={() => { const p = [...fillPick]; p[bi] = ci; setFillPick(p); }}
            >
              {c}
            </button>
          ))}
        </div>
      ))}
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
