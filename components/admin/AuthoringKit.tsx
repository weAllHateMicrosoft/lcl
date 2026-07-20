"use client";

import { useState } from "react";

// The exact import schema, embedded in a prompt you paste (with your syllabus)
// into a strong model. It returns JSON you paste back below to append lessons.
const PROMPT = `You are building curriculum for "classOS", a self-hosted teaching platform. Convert the SYLLABUS at the bottom into JSON that exactly matches this schema. Output ONLY the JSON, no commentary, no markdown fences.

TOP LEVEL:
{ "chapters": [ { "title": "Unit name", "lessons": [ LESSON, ... ] } ] }

LESSON:
{
  "code": "3.1",                       // unique, human-facing, used in URLs
  "title": "Defining Methods",
  "goal": "One sentence; <b> and <code> HTML allowed.",
  "objectives": ["Skill or concept to master", "..."],
  "blocks": [ BLOCK, ... ],            // the lesson content, in order
  "exercise": { "prompt": "what to build", "starter": "// code", "expected": "EXACT stdout", "behaviour": "plain-English", "stdin": "" },
  "masteryQuiz": [ QUESTION, ... ]      // the summative quiz; passing it = MASTERED
}

BLOCK is one of:
{ "type": "heading", "text": "Section title" }
{ "type": "prose", "html": "A paragraph. <strong>bold</strong>, <code>inline</code> allowed." }
{ "type": "code", "code": "public class Main { ... }", "out": "the program's exact output" }
{ "type": "callout", "kind": "mistake"|"tip"|"note", "title": "...", "html": "..." }
{ "type": "terms", "items": [["term","definition"], ...] }
{ "type": "check", "items": [["question","answer (hidden until student reveals)"], ...] }
{ "type": "exercise", "html": "a try-it prompt", "meta": "checks: ..." }
{ "type": "quiz", "id": "uniqueString", "title": "Quick check", "questions": [ QUESTION, ... ] }   // inline practice quiz

QUESTION is one of (each needs a unique "id" and integer "points"; info = 0 points):
{ "id":"q1", "type":"mcq",   "points":1, "q":"...", "opts":["","","",""], "correct":0, "why":"one line" }   // correct is 0-based
{ "id":"q2", "type":"tf",    "points":1, "q":"...", "correct":true, "why":"..." }
{ "id":"q3", "type":"short", "points":1, "q":"...", "answers":["accepted","also accepted"] }               // case-insensitive match
{ "id":"q4", "type":"code",  "points":2, "q":"describe the task", "starter":"// code", "expected":"EXACT stdout", "stdin":"" }
{ "id":"q5", "type":"long",  "points":3, "q":"...", "rubric":"marking guide" }                              // teacher/AI marks it
{ "id":"q6", "type":"info",  "points":0, "title":"Read this", "body":"a passage or data", "code":"optional code" }

RULES:
- This is a Java course. Students may use input("prompt"), inputInt("prompt"), inputDouble("prompt") instead of Scanner.
- For every "code"/"out" and code-question "expected", the output must be exactly what the program prints.
- Keep prose beginner-friendly. Give each lesson 6-14 blocks and a 4-6 question masteryQuiz.
- Make every "id" and lesson "code" unique.

SYLLABUS:
<<< paste your syllabus / standards / topic list here >>>`;

export default function AuthoringKit() {
  const [copied, setCopied] = useState(false);
  const [json, setJson] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function importJson() {
    setBusy(true);
    setMsg(null);
    let parsed: any;
    try {
      parsed = JSON.parse(json.trim().replace(/^```json\s*|\s*```$/g, ""));
    } catch {
      setBusy(false);
      return setMsg({ ok: false, text: "That isn't valid JSON — check the model didn't add extra text or fences." });
    }
    const chapters = Array.isArray(parsed) ? parsed : parsed.chapters;
    if (!Array.isArray(chapters)) {
      setBusy(false);
      return setMsg({ ok: false, text: 'Expected {"chapters":[...]} at the top level.' });
    }
    const r = await fetch("/api/curriculum/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapters, mode: "append" }),
    }).then((x) => x.json());
    setBusy(false);
    if (r.error) return setMsg({ ok: false, text: r.error });
    setJson("");
    setMsg({ ok: true, text: `Added ${r.added} lesson${r.added === 1 ? "" : "s"} ✓ — open the Editor to review and publish.` });
  }

  return (
    <>
      <div className="panel">
        <h2>Step 1 — copy this prompt</h2>
        <p style={{ fontSize: 14 }}>Paste it into Claude or Gemini (AI Studio), replace the last line with your syllabus, and send.</p>
        <pre className="promptbox">{PROMPT}</pre>
        <button
          className="btn green"
          onClick={() => {
            navigator.clipboard?.writeText(PROMPT);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied ✓" : "Copy prompt"}
        </button>
      </div>

      <div className="panel">
        <h2>Step 2 — paste the JSON it gives back</h2>
        <p style={{ fontSize: 14 }}>This <b>appends</b> to your curriculum (nothing is deleted). Colliding lesson codes get a "-2" suffix.</p>
        <textarea className="f" style={{ fontFamily: "var(--mono)", fontSize: 12, minHeight: 180 }} value={json} onChange={(e) => setJson(e.target.value)} placeholder='{ "chapters": [ ... ] }' />
        {msg && <div className={msg.ok ? "notice" : "offline-note"} style={{ marginTop: 10 }}>{msg.text}</div>}
        <div className="runrow">
          <button className="btn green" onClick={importJson} disabled={busy || !json.trim()}>{busy ? "importing…" : "Append to curriculum"}</button>
        </div>
      </div>

      <p className="dashnote">Tip: draft one unit at a time so the model can stay detailed. Everything imports as a draft you can edit and publish in the Editor.</p>
    </>
  );
}
