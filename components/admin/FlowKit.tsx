"use client";

import { useState } from "react";

// Flow authoring kit: copy the mega-prompt (the full step-type catalog with one
// worked example per kind) into any strong external AI together with your
// lesson material → paste the JSON back → import. The importer compiles and
// RUNS every snippet against the real Java runner before accepting, so a
// hallucinated output can't ship.

const MEGA_PROMPT = `You are designing an INTERACTIVE lesson "flow" for a learn-by-doing Java platform. A flow is a sequence of steps, ONE interaction per screen. Iron rules:
- Near-zero text. Instructions ≤ 10 words. Explanations ("why"/"after") are ONE line and appear AFTER the student acts — the surprise does the teaching, the caption names it.
- The gate is DOING, not reading. Never explain a concept before the student has touched it.
- Ramp: start where a total beginner cannot fail (press one button), end with building from scratch. Mix kinds — never two identical kinds in a row if avoidable.
- Code snippets are Java STATEMENTS (they get wrapped in main() automatically). No class/main boilerplate.
- Escapes: in JSON, "\\\\n" is a backslash-n IN THE JAVA SOURCE; "\\n" is a real newline in a target/option string. Be exact — every snippet is machine-verified by actually compiling and running it, and the import is REJECTED if any claim is wrong.
- 10–16 steps ≈ one lesson. Give each step a unique id like "f<lessonNoDots>_<n>" (e.g. f22_4).
- Optional per step: "skills": ["short ability statement", ...] — ties the step to mastery tracking. Use the same wording across steps testing the same ability.
- Optional per step: "hint" (one authored line, shown on demand after a failure), "after" (one-line caption on success), "why" (one-line caption on a graded reveal).

Return ONLY JSON: {"v":1,"steps":[...]}. The 14 step kinds, each with a worked example:

1. run — press ▶, watch it happen. Fields: code.
{"id":"f_1","kind":"run","instruction":"This is a Java program. Run it.","code":"System.out.println(\\"Hello!\\");","after":"You told the computer what to do. It did it."}

2. tweak — change the code, make the output yours. target = the ORIGINAL output (success = output differs).
{"id":"f_2","kind":"tweak","instruction":"Change the message. Run it.","code":"System.out.println(\\"Hello!\\");","target":"Hello!","hint":"Only change the words between the quotes.","after":"Your words on the screen."}

3. note — one-beat divider card, no interaction. Use at most 1–2 per lesson.
{"id":"f_3","kind":"note","instruction":"Part 2 — making decisions."}

4. predict — tap what it prints, THEN see. opts are literal outputs (use real newlines "\\n" inside an option for multi-line output; an error option should contain the word "error"). correct is 0-based. why is REQUIRED.
{"id":"f_4","kind":"predict","instruction":"What prints?","code":"System.out.println(\\"1\\" + 2 + 3);","opts":["123","6","15","(an error)"],"correct":0,"why":"Left to right: text + number glues into text."}

5. spot — tap the LINE (the bug, or the one that does X). correct = 0-based line index into code. why REQUIRED.
{"id":"f_5","kind":"spot","instruction":"Tap the line with the bug.","code":"int x = 5;\\nint y = 10\\nSystem.out.println(x + y);","correct":1,"why":"Line 2 is missing its semicolon."}

6. trace — follow a variable through code via checkpoints. Each question: prompt, opts, correct, why.
{"id":"f_6","kind":"trace","instruction":"Follow x.","code":"int x = 3;\\nx = x * 2;\\nx = x + 1;","questions":[{"prompt":"after line 2, x = ?","opts":["6","5","3"],"correct":0,"why":"3 * 2."},{"prompt":"after line 3, x = ?","opts":["7","6","4"],"correct":0,"why":"6 + 1."}]}

7. fix — broken code → make it match the target. solution (server-only, used to verify the step is solvable) is REQUIRED. The broken code should fail or produce the WRONG output — never the target already.
{"id":"f_7","kind":"fix","instruction":"Make it match the target.","code":"System.out.print(\\"Hi\\");\\nSystem.out.print(\\"Bye\\");","target":"Hi\\nBye","solution":"System.out.println(\\"Hi\\");\\nSystem.out.println(\\"Bye\\");","hint":"Which one ends the line — print or println?"}

8. write — build the target from scratch. code = starter (may be a comment). solution REQUIRED.
{"id":"f_8","kind":"write","instruction":"Print the countdown — match it exactly.","code":"// your code here\\n","target":"3\\n2\\n1","solution":"System.out.println(3);\\nSystem.out.println(2);\\nSystem.out.println(1);","hint":"One println per line."}

9. arrange — tap shuffled lines into order. lines[] in CORRECT order (player shuffles); optional distractors[] = decoy lines that belong to no valid solution.
{"id":"f_9","kind":"arrange","instruction":"Order the lines to match the target.","lines":["int total = 0;","total = total + 5;","System.out.println(total);"],"distractors":["System.out.println(\\"total\\");"],"target":"5"}

10. fill — code with ⟦1⟧ ⟦2⟧ markers; per blank: chips to tap + the 0-based answer. Wrong chips should be plausible (compile-adjacent).
{"id":"f_10","kind":"fill","instruction":"Fill the blanks so it prints 8.","code":"int a = ⟦1⟧;\\nSystem.out.println(a ⟦2⟧ 3);","blanks":[{"chips":["5","3","8"],"answer":0},{"chips":["+","*","-"],"answer":0}],"target":"8"}

11. bucket — deal each item into the right bucket. buckets = labels; items = {text, bucket(0-based)}.
{"id":"f_11","kind":"bucket","instruction":"Which type holds it?","buckets":["int","double","String"],"items":[{"text":"42","bucket":0},{"text":"3.14","bucket":1},{"text":"\\"hello\\"","bucket":2},{"text":"-7","bucket":0}],"why":"Whole numbers → int, decimals → double, quoted text → String."}

12. match — connect pairs (term↔meaning, code↔output). Player shuffles the right side.
{"id":"f_12","kind":"match","instruction":"Match each escape to what it prints.","pairs":[["\\\\n","a new line"],["\\\\t","a tab gap"],["\\\\\\"","a quote mark"]],"why":"Backslash means: the next character is special."}

13. explain — the student convinces the AI in a sentence; it judges against your rubric and probes gently, never revealing. fallback = the model answer if AI is offline. Use 1× per lesson max, at the peak concept.
{"id":"f_13","kind":"explain","instruction":"Say it in your own words.","prompt":"Why does 1 + 2 + \\"3\\" print 33 and not 123?","rubric":"Must convey: evaluation is left-to-right; 1+2 happens as real math first (3); once a String joins, + concatenates (3 + \\"3\\" → \\"33\\").","fallback":"Java reads left to right: 1+2=3 is math, then 3 + \\"3\\" glues into \\"33\\".","skills":["predict the result of string concatenation mixed with numeric addition"]}

14. branch — offer a jump ("seen this before?"). goto = a step id in this flow.
{"id":"f_14","kind":"branch","instruction":"Used println before?","options":[{"label":"Nope — show me","goto":"f_1"},{"label":"Yes — skip to the challenge","goto":"f_8"}]}

Now design the flow for the lesson material I paste below. Target audience: absolute beginners AND impatient students who half-know it. Arc: hook (run/tweak) → think-first (predict/spot/trace) → build (fix/fill/arrange) → sort/connect if it fits → one explain at the peak concept → write finale. Output the JSON only.

LESSON MATERIAL:
`;

export default function FlowKit({ lessons }: { lessons: { code: string; title: string; hasFlow: boolean }[] }) {
  const [lessonCode, setLessonCode] = useState(lessons[0]?.code || "");
  const [json, setJson] = useState("");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ ok?: boolean; results?: string[]; failures?: string[]; steps?: number; tagged?: number } | null>(null);
  const [copied, setCopied] = useState(false);

  async function importFlow() {
    setBusy(true);
    setReport(null);
    let flow: unknown;
    try {
      flow = JSON.parse(json);
    } catch (e) {
      setReport({ ok: false, failures: [`Not valid JSON: ${(e as Error).message.slice(0, 120)}`] });
      setBusy(false);
      return;
    }
    const d = await fetch("/api/curriculum/flow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonCode, flow }),
    }).then((r) => r.json());
    setReport(d);
    setBusy(false);
  }

  return (
    <div style={{ marginTop: 30 }}>
      <h2 style={{ fontFamily: "var(--serif)", fontSize: 20, margin: "0 0 4px" }}>Interactive flows (the step player)</h2>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginBottom: 12 }}>
        14 step kinds — run, tweak, note, predict, spot, trace, fix, write, arrange, fill, bucket, match, explain, branch.
        Copy the prompt, paste it into a strong AI <b>followed by the lesson's content</b>, then paste the JSON back here.
        Every snippet is <b>compiled and run against the real Java runner</b> on import — a wrong claim is rejected, so AIs can't ship a lying lesson.
      </p>

      <div className="runrow">
        <button
          className="btn ghost"
          onClick={async () => { await navigator.clipboard.writeText(MEGA_PROMPT); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
        >
          {copied ? "copied ✓" : "📋 Copy the flow-design prompt"}
        </button>
        <label className="field" style={{ margin: 0, minWidth: 240 }}>
          <select className="f" value={lessonCode} onChange={(e) => setLessonCode(e.target.value)}>
            {lessons.map((l) => (
              <option key={l.code} value={l.code}>
                {l.code} · {l.title} {l.hasFlow ? "· has flow ✓" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

      <textarea
        className="f"
        rows={7}
        style={{ fontFamily: "var(--mono)", fontSize: 12, marginTop: 10 }}
        value={json}
        onChange={(e) => setJson(e.target.value)}
        placeholder='paste the AI’s JSON here: {"v":1,"steps":[...]}'
      />
      <div className="runrow" style={{ marginTop: 8 }}>
        <button className="btn green" disabled={busy || !json.trim()} onClick={importFlow}>
          {busy ? "verifying every snippet against the compiler…" : `Verify + import → ${lessonCode}`}
        </button>
      </div>

      {report && (
        <div className="panel" style={{ marginTop: 10, borderColor: report.ok ? "var(--accent)" : "#b3352e" }}>
          {report.ok ? (
            <b>✓ imported — {report.steps} steps{report.tagged ? `, ${report.tagged} skill tags` : ""}. The lesson now opens as an interactive flow.</b>
          ) : (
            <b style={{ color: "#b3352e" }}>✗ rejected — fix these and re-paste:</b>
          )}
          {(report.failures || []).map((f, i) => (
            <div key={i} className="meta" style={{ margin: "4px 0", color: "#b3352e" }}>✗ {f}</div>
          ))}
          {(report.results || []).map((r, i) => (
            <div key={i} className="meta" style={{ margin: "3px 0" }}>{r}</div>
          ))}
        </div>
      )}
    </div>
  );
}
