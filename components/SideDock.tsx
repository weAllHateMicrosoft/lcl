"use client";

// The always-available side dock: Scratchpad + AI Tutor, reachable from any
// scroll position via the edge rail instead of being buried mid-page. The
// tutor sees the scratchpad code, so "ask about my code" just works.
// Scratchpad code survives navigation + reloads via localStorage.

import { useEffect, useState } from "react";
import CodeEditor from "./CodeEditor";

const STORE_KEY = "classos_scratchpad";
const DEFAULT_CODE = 'String name = input("Your name? ");\nSystem.out.println("Hi, " + name + "!");';

async function postJSON(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}

export default function SideDock({ lessonCode }: { lessonCode: string }) {
  const [tab, setTab] = useState<null | "code" | "tutor">(null);
  const [wide, setWide] = useState(false);
  const [code, setCode] = useState(DEFAULT_CODE);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved) setCode(saved);
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (loaded) localStorage.setItem(STORE_KEY, code);
  }, [code, loaded]);

  return (
    <>
      {tab === null && (
        <div className="dockrail">
          <button onClick={() => setTab("code")}>▶ Scratchpad</button>
          <button onClick={() => setTab("tutor")}>✦ AI Tutor</button>
        </div>
      )}
      {tab !== null && (
        <div className={`dockpanel ${wide ? "wide" : ""}`}>
          <div className="dockhead">
            <button className={`dtab ${tab === "code" ? "on" : ""}`} onClick={() => setTab("code")}>
              ▶ Scratchpad
            </button>
            <button className={`dtab ${tab === "tutor" ? "on" : ""}`} onClick={() => setTab("tutor")}>
              ✦ AI Tutor
            </button>
            <span style={{ flex: 1 }} />
            <button className="dbtn" title={wide ? "Narrow" : "Expand"} onClick={() => setWide(!wide)}>
              {wide ? "⇥" : "⇤"}
            </button>
            <button className="dbtn" title="Close" onClick={() => setTab(null)}>
              ✕
            </button>
          </div>
          <div className="dockbody">
            <div style={{ display: tab === "code" ? "block" : "none" }}>
              <Scratchpad code={code} setCode={setCode} />
            </div>
            <div style={{ display: tab === "tutor" ? "block" : "none" }}>
              <Tutor lessonCode={lessonCode} scratchCode={code} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ── Scratchpad ────────────────────────────────────────────────────────── */
function Scratchpad({ code, setCode }: { code: string; setCode: (v: string) => void }) {
  const [stdin, setStdin] = useState("Ada");
  const [out, setOut] = useState<{ text: string; err: boolean } | null>(null);
  const [meta, setMeta] = useState("idle");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setMeta("compiling & running…");
    const r = await postJSON("/api/run", { code, stdin: stdin.replace(/\\n/g, "\n"), wrap: true });
    setOut({ text: r.compiled === false ? r.error : r.stdout || "(no output)", err: r.compiled === false });
    setMeta(r.compiled === false ? "compile error" : "done — real execution");
    setBusy(false);
  }

  return (
    <>
      <p style={{ fontSize: 13.5, color: "var(--muted)", marginBottom: 10 }}>
        Experiment freely — nothing here is graded. <code>input()</code> / <code>inputInt()</code> work without Scanner
        boilerplate. Your code sticks around when you change lessons.
      </p>
      <CodeEditor value={code} onChange={setCode} height="220px" />
      <div className="stdinrow">
        <label>stdin (one value per line, \n allowed):</label>
        <input value={stdin} onChange={(e) => setStdin(e.target.value)} placeholder="e.g. 7" style={{ minWidth: 120, flex: 1 }} />
      </div>
      <div className="runrow">
        <button className="btn blue" onClick={run} disabled={busy}>
          ▶ Run
        </button>
        <button className="btn ghost" onClick={() => setCode(DEFAULT_CODE)}>
          Reset
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

/* ── Tutor (sees the scratchpad code) ──────────────────────────────────── */
function Tutor({ lessonCode, scratchCode }: { lessonCode: string; scratchCode: string }) {
  const [msgs, setMsgs] = useState<{ role: "u" | "a"; text: string; meta?: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(message: string) {
    if (!message.trim() || busy) return;
    setMsgs((m) => [...m, { role: "u", text: message }]);
    setInput("");
    setBusy(true);
    const r = await postJSON("/api/ai", { feature: "tutor", lessonCode, message, code: scratchCode });
    setMsgs((m) => [...m, { role: "a", text: r.text, meta: r.meta }]);
    setBusy(false);
  }

  return (
    <div className="tutor">
      <div className="msgs" style={{ maxHeight: "none" }}>
        <div className="msg a">
          <span className="who">TUTOR</span>
          Hi! I can explain this topic, look at your scratchpad code, or nudge you when you're stuck — but I won't write full
          solutions.
        </div>
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {m.role === "a" && <span className="who">TUTOR</span>}
            {m.text}
            {m.meta && <span className="meta">{m.meta}</span>}
          </div>
        ))}
        {busy && <div className="msg a think">tutor is thinking…</div>}
      </div>
      <div className="quick">
        <button className="chip" onClick={() => ask("Can you review the code in my scratchpad?")}>Review my code</button>
        <button className="chip" onClick={() => ask("Why doesn't my scratchpad code work?")}>Why doesn't it work?</button>
        <button className="chip" onClick={() => ask("I'm stuck — a hint please?")}>Hint</button>
      </div>
      <div className="askrow">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && ask(input)}
          placeholder="Ask about this topic or your code…"
          disabled={busy}
        />
        <button className="btn" onClick={() => ask(input)} disabled={busy}>
          Ask
        </button>
      </div>
      <div className="scopenote">the tutor sees: this lesson · your record · your scratchpad code</div>
    </div>
  );
}
