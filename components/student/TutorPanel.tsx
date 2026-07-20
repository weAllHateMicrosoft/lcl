"use client";

// Tutor tool content. Owns its chat history. Accepts a `seed` (from highlight-
// to-ask); when its nonce changes, it auto-sends that question. Sees the
// scratchpad code so "review my code" works.

import { useEffect, useRef, useState } from "react";

export default function TutorPanel({
  lessonCode,
  scratchCode,
  seed,
}: {
  lessonCode: string;
  scratchCode: string;
  seed: { text: string; prompt?: string; nonce: number };
}) {
  const [msgs, setMsgs] = useState<{ role: "u" | "a"; text: string; meta?: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSeed = useRef(0);

  async function ask(message: string) {
    if (!message.trim() || busy) return;
    setMsgs((m) => [...m, { role: "u", text: message }]);
    setInput("");
    setBusy(true);
    const r = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feature: "tutor", lessonCode, message, code: scratchCode }),
    }).then((x) => x.json());
    setMsgs((m) => [...m, { role: "a", text: r.text || r.error || "…", meta: r.meta }]);
    setBusy(false);
  }

  // highlight-to-ask: when a new selection is sent, ask about it.
  useEffect(() => {
    if (seed.nonce && seed.nonce !== lastSeed.current) {
      lastSeed.current = seed.nonce;
      const q = seed.prompt?.trim() || "Can you explain this part of the lesson?";
      ask(`${q}\n\n"${seed.text}"`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed.nonce]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [msgs, busy]);

  return (
    <div className="tutor" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div className="msgs" ref={scrollRef} style={{ maxHeight: "none", flex: 1 }}>
        <div className="msg a">
          <span className="who">TUTOR</span>
          Hi! Ask me about this topic or your scratchpad code — or highlight any part of the lesson and hit “Ask AI”. I give
          hints, never full solutions.
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
    </div>
  );
}
