"use client";

// Scratchpad tool content. Code is lifted to the parent so the tutor can see it
// and so it survives lesson changes; persistence handled by the parent.

import { useState } from "react";
import CodeEditor from "../CodeEditor";

export default function ScratchpadPanel({ code, setCode }: { code: string; setCode: (v: string) => void }) {
  const [stdin, setStdin] = useState("Ada");
  const [out, setOut] = useState<{ text: string; err: boolean } | null>(null);
  const [meta, setMeta] = useState("idle");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setMeta("compiling & running…");
    const r = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, stdin: stdin.replace(/\\n/g, "\n"), wrap: true }),
    }).then((x) => x.json());
    setOut({ text: r.compiled === false ? r.error : r.stdout || "(no output)", err: r.compiled === false });
    setMeta(r.compiled === false ? "compile error" : "done — real execution");
    setBusy(false);
  }

  return (
    <>
      <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
        Experiment freely — nothing here is graded. <code>input()</code> / <code>inputInt()</code> work with no Scanner
        boilerplate. Code persists across lessons, and the AI Tutor can see it.
      </p>
      <CodeEditor value={code} onChange={setCode} height="200px" />
      <div className="stdinrow">
        <label>stdin (\n allowed):</label>
        <input value={stdin} onChange={(e) => setStdin(e.target.value)} placeholder="e.g. 7" style={{ minWidth: 100, flex: 1 }} />
      </div>
      <div className="runrow">
        <button className="btn blue" onClick={run} disabled={busy}>
          ▶ Run
        </button>
      </div>
      <div className="console">
        <div className="chead">
          <span>OUTPUT</span>
          <span>{meta}</span>
        </div>
        <div className={`cbody ${out?.err ? "err" : ""}`}>{out ? out.text : <span className="mutedtx">run to see output…</span>}</div>
      </div>
    </>
  );
}
