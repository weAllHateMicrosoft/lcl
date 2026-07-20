"use client";

// Scratchpad v2 — built for flow:
//   · code LEFT, output RIGHT (stacks when the window is narrow)
//   · Ctrl/Cmd+Enter runs · copy output · stdin tucked behind a toggle
//   · a built-in AI strip at the bottom: ask about the code without switching
//     windows (the full Tutor window remains for longer conversations)

import { useRef, useState } from "react";
import CodeEditor from "../CodeEditor";

export default function ScratchpadPanel({
  code,
  setCode,
  lessonCode,
}: {
  code: string;
  setCode: (v: string) => void;
  lessonCode: string;
}) {
  const [stdinOpen, setStdinOpen] = useState(false);
  const [stdin, setStdin] = useState("");
  const [out, setOut] = useState<{ text: string; err: boolean } | null>(null);
  const [meta, setMeta] = useState("idle");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // mini AI strip
  const [aiQ, setAiQ] = useState("");
  const [aiMsgs, setAiMsgs] = useState<{ role: "u" | "a"; text: string }[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const aiScroll = useRef<HTMLDivElement>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setMeta("running…");
    const r = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, stdin: stdin.replace(/\\n/g, "\n"), wrap: true }),
    }).then((x) => x.json());
    setOut({ text: r.compiled === false ? r.error : r.stdout || "(no output)", err: r.compiled === false });
    setMeta(r.compiled === false ? "compile error" : "done");
    setBusy(false);
  }

  async function askAi(q: string) {
    const question = q.trim();
    if (!question || aiBusy) return;
    setAiQ("");
    setAiMsgs((m) => [...m, { role: "u", text: question }]);
    setAiBusy(true);
    const r = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        feature: "tutor",
        lessonCode,
        code,
        message: `${question}${out ? `\n\n(The program's last output was:\n${out.text})` : ""}`,
      }),
    }).then((x) => x.json());
    setAiMsgs((m) => [...m, { role: "a", text: r.text || r.error || "…" }]);
    setAiBusy(false);
    setTimeout(() => aiScroll.current?.scrollTo(0, aiScroll.current.scrollHeight), 50);
  }

  return (
    <div
      style={{ display: "flex", flexDirection: "column", height: "100%", gap: 10 }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
          e.preventDefault();
          run();
        }
      }}
    >
      {/* toolbar */}
      <div className="runrow" style={{ margin: 0 }}>
        <button className="btn blue" onClick={run} disabled={busy}>
          ▶ Run
        </button>
        <span className="runnote">⌘/Ctrl + Enter</span>
        <span style={{ flex: 1 }} />
        <button className={`tbtn2 ${stdinOpen ? "" : ""}`} title="Program input (stdin)" onClick={() => setStdinOpen(!stdinOpen)}>
          ⌨ input
        </button>
        <button
          className="tbtn2"
          title="Copy output"
          onClick={() => {
            if (out) {
              navigator.clipboard?.writeText(out.text);
              setCopied(true);
              setTimeout(() => setCopied(false), 1000);
            }
          }}
        >
          {copied ? "✓" : "⧉"}
        </button>
        <button className="tbtn2" title="Clear code" onClick={() => setCode("// fresh start\n")}>
          ↺
        </button>
      </div>

      {stdinOpen && (
        <div className="stdinrow" style={{ margin: 0 }}>
          <label>stdin (for input() — one value per line, \n ok):</label>
          <input value={stdin} onChange={(e) => setStdin(e.target.value)} placeholder="e.g. 7" style={{ minWidth: 100, flex: 1 }} />
        </div>
      )}

      {/* code | output side by side */}
      <div className="padgrid">
        <div className="padcode">
          <CodeEditor value={code} onChange={setCode} height="100%" />
        </div>
        <div className="console" style={{ margin: 0, display: "flex", flexDirection: "column" }}>
          <div className="chead">
            <span>OUTPUT</span>
            <span>{meta}</span>
          </div>
          <div className={`cbody ${out?.err ? "err" : ""}`} style={{ flex: 1, overflowY: "auto" }}>
            {out ? out.text : <span className="mutedtx">▶ or ⌘Enter to run…</span>}
          </div>
        </div>
      </div>

      {/* built-in AI strip */}
      <div className="padai">
        {aiMsgs.length > 0 && (
          <div className="padai-msgs" ref={aiScroll}>
            {aiMsgs.map((m, i) => (
              <div key={i} className={`msg ${m.role}`} style={{ fontSize: 13, padding: "8px 11px" }}>
                {m.role === "a" && <span className="who">TUTOR</span>}
                {m.text}
              </div>
            ))}
            {aiBusy && <div className="msg a think" style={{ fontSize: 13, padding: "8px 11px" }}>thinking…</div>}
          </div>
        )}
        <div className="askrow">
          <input
            value={aiQ}
            onChange={(e) => setAiQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") askAi(aiQ);
              e.stopPropagation(); // don't trigger the run shortcut while typing here
            }}
            placeholder="✦ Ask AI about this code… (sees code + output)"
            disabled={aiBusy}
          />
          <button className="btn purple" style={{ padding: "8px 13px" }} onClick={() => askAi(aiQ)} disabled={aiBusy}>
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}
