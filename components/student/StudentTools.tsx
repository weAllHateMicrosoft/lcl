"use client";

// Orchestrates the student's floating tools (scratchpad + tutor windows) and the
// highlight-to-ask popup. Highlighting lesson text opens a mini composer:
// optionally type a question, then send it to the AI tutor — or to the teacher
// (when the teacher has enabled that in their settings).

import { useEffect, useState } from "react";
import { useWindowState } from "./useWindowState";
import FloatingWindow from "./FloatingWindow";
import ScratchpadPanel from "./ScratchpadPanel";
import TutorPanel from "./TutorPanel";

const SCRATCH_KEY = "classos_scratchpad";
const DEFAULT_CODE = 'String name = input("Your name? ");\nSystem.out.println("Hi, " + name + "!");';

export default function StudentTools({
  lessonCode,
  askTeacher,
}: {
  lessonCode: string;
  askTeacher: { id: string; name: string } | null;
}) {
  const scratch = useWindowState("scratchpad");
  const tutor = useWindowState("tutor");
  const [code, setCode] = useState(DEFAULT_CODE);
  const [codeLoaded, setCodeLoaded] = useState(false);
  const [seed, setSeed] = useState({ text: "", prompt: "", nonce: 0 });
  const [popup, setPopup] = useState<{ x: number; y: number; text: string } | null>(null);
  const [prompt, setPrompt] = useState("");
  const [sentNote, setSentNote] = useState("");

  useEffect(() => {
    const s = localStorage.getItem(SCRATCH_KEY);
    if (s) setCode(s);
    setCodeLoaded(true);
  }, []);
  useEffect(() => {
    if (codeLoaded) localStorage.setItem(SCRATCH_KEY, code);
  }, [code, codeLoaded]);

  // show the composer when lesson text is selected
  useEffect(() => {
    function onUp(e: MouseEvent) {
      if ((e.target as HTMLElement).closest?.(".askpop2, .toolwin, .dockrail")) return;
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (!sel || sel.isCollapsed || text.length < 3) return setPopup(null);
      const anchor = sel.anchorNode?.parentElement;
      if (!anchor || !anchor.closest(".lesson-body")) return setPopup(null);
      const r = sel.getRangeAt(0).getBoundingClientRect();
      setPopup({ x: Math.min(r.left + r.width / 2, window.innerWidth - 190), y: r.bottom + 8, text: text.slice(0, 500) });
      setPrompt("");
    }
    document.addEventListener("mouseup", onUp);
    return () => document.removeEventListener("mouseup", onUp);
  }, []);

  function askAI() {
    if (!popup) return;
    setSeed({ text: popup.text, prompt, nonce: Date.now() });
    if (tutor.state.mode === "closed") tutor.patch({ mode: "float" });
    setPopup(null);
    window.getSelection()?.removeAllRanges();
  }

  async function askTeacherNow() {
    if (!popup || !askTeacher) return;
    // Lines starting with "> " render as a highlighted quote in the inbox (both sides).
    const body = `${prompt.trim() || "Can you help me with this part?"}\n> ${popup.text.slice(0, 300)}\n(lesson ${lessonCode})`;
    await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toId: askTeacher.id, body, lessonCode }),
    });
    setPopup(null);
    window.getSelection()?.removeAllRanges();
    setSentNote(`Sent to ${askTeacher.name} ✓ — replies land in your ✉ Messages`);
    setTimeout(() => setSentNote(""), 3500);
  }

  return (
    <>
      {popup && (
        <div className="askpop2" style={{ left: popup.x, top: popup.y }}>
          <div className="quoteprev">“{popup.text.slice(0, 90)}{popup.text.length > 90 ? "…" : ""}”</div>
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && askAI()}
            placeholder="Your question (optional)…"
            autoFocus
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button className="btn purple" style={{ flex: 1, padding: "7px 10px", fontSize: 12.5 }} onClick={askAI}>
              ✦ Ask AI
            </button>
            {askTeacher && (
              <button className="btn" style={{ flex: 1, padding: "7px 10px", fontSize: 12.5 }} onClick={askTeacherNow}>
                ✉ Ask {askTeacher.name.split(" ")[0]}
              </button>
            )}
            <button className="tbtn2" onClick={() => setPopup(null)}>✕</button>
          </div>
        </div>
      )}
      {sentNote && <div className="sentnote">{sentNote}</div>}

      <div className="dockrail">
        <button className={scratch.state.mode !== "closed" ? "on" : ""} onClick={() => scratch.patch({ mode: scratch.state.mode === "closed" ? "docked" : "closed" })}>
          ▶ Scratchpad
        </button>
        <button className={tutor.state.mode !== "closed" ? "on" : ""} onClick={() => tutor.patch({ mode: tutor.state.mode === "closed" ? "docked" : "closed" })}>
          ✦ AI Tutor
        </button>
      </div>

      {scratch.state.mode !== "closed" && (
        <FloatingWindow title="Scratchpad" icon="▶" state={scratch.state} patch={scratch.patch} onClose={() => scratch.patch({ mode: "closed" })}>
          <ScratchpadPanel code={code} setCode={setCode} lessonCode={lessonCode} />
        </FloatingWindow>
      )}

      {tutor.state.mode !== "closed" && (
        <FloatingWindow title="AI Tutor" icon="✦" state={tutor.state} patch={tutor.patch} onClose={() => tutor.patch({ mode: "closed" })}>
          <TutorPanel lessonCode={lessonCode} scratchCode={code} seed={seed} />
        </FloatingWindow>
      )}
    </>
  );
}
