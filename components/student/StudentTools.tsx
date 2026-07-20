"use client";

// Orchestrates the student's floating tools. Each tool (scratchpad, tutor) is an
// independent window that can be docked or floated and never shares space with
// the other. Also owns the "highlight lesson text → Ask AI" popup, which routes
// the selection into the tutor.

import { useEffect, useRef, useState } from "react";
import { useWindowState } from "./useWindowState";
import FloatingWindow from "./FloatingWindow";
import ScratchpadPanel from "./ScratchpadPanel";
import TutorPanel from "./TutorPanel";

const SCRATCH_KEY = "classos_scratchpad";
const DEFAULT_CODE = 'String name = input("Your name? ");\nSystem.out.println("Hi, " + name + "!");';

export default function StudentTools({ lessonCode }: { lessonCode: string }) {
  const scratch = useWindowState("scratchpad");
  const tutor = useWindowState("tutor");
  const [code, setCode] = useState(DEFAULT_CODE);
  const [codeLoaded, setCodeLoaded] = useState(false);
  const [seed, setSeed] = useState({ text: "", nonce: 0 });
  const [popup, setPopup] = useState<{ x: number; y: number; text: string } | null>(null);

  // persist scratchpad code
  useEffect(() => {
    const s = localStorage.getItem(SCRATCH_KEY);
    if (s) setCode(s);
    setCodeLoaded(true);
  }, []);
  useEffect(() => {
    if (codeLoaded) localStorage.setItem(SCRATCH_KEY, code);
  }, [code, codeLoaded]);

  // highlight-to-ask: show a popup when text inside the lesson body is selected
  useEffect(() => {
    function onUp() {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (!sel || sel.isCollapsed || text.length < 3) return setPopup(null);
      const anchor = sel.anchorNode?.parentElement;
      if (!anchor || !anchor.closest(".lesson-body")) return setPopup(null);
      const r = sel.getRangeAt(0).getBoundingClientRect();
      setPopup({ x: r.left + r.width / 2, y: r.top - 10, text: text.slice(0, 500) });
    }
    document.addEventListener("mouseup", onUp);
    return () => document.removeEventListener("mouseup", onUp);
  }, []);

  function askAboutSelection() {
    if (!popup) return;
    setSeed({ text: popup.text, nonce: Date.now() });
    if (tutor.state.mode === "closed") tutor.patch({ mode: "float" });
    setPopup(null);
    window.getSelection()?.removeAllRanges();
  }

  return (
    <>
      {/* selection popup */}
      {popup && (
        <button
          className="askpop"
          style={{ left: popup.x, top: popup.y }}
          onMouseDown={(e) => e.preventDefault()}
          onClick={askAboutSelection}
        >
          ✦ Ask AI about this
        </button>
      )}

      {/* launcher rail (always visible) */}
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
          <ScratchpadPanel code={code} setCode={setCode} />
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
