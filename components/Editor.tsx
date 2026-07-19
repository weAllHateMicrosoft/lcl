"use client";

import { useEffect, useRef, useState } from "react";
import LessonRenderer from "./LessonRenderer";
import type { Block } from "@/lib/curriculum/blocks";

type Lesson = { id: string; code: string; title: string; goal: string; blocks: Block[]; exercise: any; quizBank: any };
type Chapter = { id: string; title: string; order: number; lessons: Lesson[] };

const NEW_BLOCK: Record<string, () => Block> = {
  heading: () => ({ type: "heading", text: "New heading" }),
  prose: () => ({ type: "prose", html: "New paragraph." }),
  code: () => ({ type: "code", code: "// code", out: "" }),
  callout: () => ({ type: "callout", kind: "note", title: "Note", html: "…" }),
  exercise: () => ({ type: "exercise", html: "Try this…", meta: "" }),
};

export default function Editor() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [sel, setSel] = useState<{ c: number; l: number }>({ c: 0, l: 0 });
  const [saveState, setSaveState] = useState("loaded");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/curriculum")
      .then((r) => r.json())
      .then((d) => setChapters(d.chapters || []));
  }, []);

  const lesson = chapters[sel.c]?.lessons[sel.l];

  // keep a ref so the debounced save reads current state
  const chaptersRef = useRef(chapters);
  chaptersRef.current = chapters;

  function mutate(fn: (l: Lesson) => void) {
    setChapters((prev) => {
      const next = structuredClone(prev);
      fn(next[sel.c].lessons[sel.l]);
      return next;
    });
    scheduleSave();
  }

  function scheduleSave() {
    setSaveState("saving…");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(save, 800);
  }

  async function save() {
    const l = chaptersRef.current[sel.c]?.lessons[sel.l];
    if (!l) return;
    await fetch("/api/curriculum", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: l.code, title: l.title, goal: l.goal, blocks: l.blocks, exercise: l.exercise, quizBank: l.quizBank }),
    });
    setSaveState("saved ✓");
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify({ chapters }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "classos-curriculum.json";
    a.click();
  }

  async function importJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await fetch("/api/curriculum/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: text });
    const d = await fetch("/api/curriculum").then((r) => r.json());
    setChapters(d.chapters || []);
    setSel({ c: 0, l: 0 });
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <h4>Curriculum</h4>
        {chapters.map((c, ci) => (
          <div key={c.id}>
            <div style={{ fontWeight: 700, fontSize: 13, padding: "8px 12px" }}>{c.title}</div>
            {c.lessons.map((l, li) => (
              <a key={l.id} className={ci === sel.c && li === sel.l ? "active" : ""} onClick={() => setSel({ c: ci, l: li })} style={{ cursor: "pointer" }}>
                <span>
                  <span style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 11 }}>{l.code}</span> {l.title}
                </span>
              </a>
            ))}
          </div>
        ))}
        <div style={{ padding: "14px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
          <button className="btn" onClick={exportJSON}>Export JSON</button>
          <label className="btn" style={{ textAlign: "center", cursor: "pointer" }}>
            Import JSON
            <input type="file" accept="application/json" hidden onChange={importJSON} />
          </label>
        </div>
      </aside>

      <main className="main" style={{ maxWidth: "none", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
        {!lesson ? (
          <p>Loading…</p>
        ) : (
          <>
            {/* Editing column */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h2 style={{ margin: 0, fontSize: 16 }}>Edit</h2>
                <span className="meta" style={{ margin: 0 }}>{saveState}</span>
              </div>
              <label className="field">
                <span className="l">Title</span>
                <input className="f" value={lesson.title} onChange={(e) => mutate((l) => (l.title = e.target.value))} />
              </label>
              <label className="field">
                <span className="l">Goal <span className="hint">(HTML allowed)</span></span>
                <textarea className="f" rows={2} value={lesson.goal} onChange={(e) => mutate((l) => (l.goal = e.target.value))} />
              </label>

              {lesson.blocks.map((b, i) => (
                <BlockEditor
                  key={i}
                  block={b}
                  onChange={(nb) => mutate((l) => (l.blocks[i] = nb))}
                  onMove={(d) => mutate((l) => { const t = l.blocks[i]; l.blocks[i] = l.blocks[i + d]; l.blocks[i + d] = t; })}
                  onDelete={() => mutate((l) => l.blocks.splice(i, 1))}
                  canUp={i > 0}
                  canDown={i < lesson.blocks.length - 1}
                />
              ))}

              <div className="row-btns" style={{ marginTop: 12 }}>
                {Object.keys(NEW_BLOCK).map((t) => (
                  <button key={t} className="btn" onClick={() => mutate((l) => l.blocks.push(NEW_BLOCK[t]()))}>
                    + {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Live preview — the SAME renderer students see */}
            <div>
              <h2 style={{ margin: "0 0 12px", fontSize: 16 }}>Preview</h2>
              <div className="lesson">
                <h1 style={{ fontSize: 22 }}>{lesson.title}</h1>
                <div className="goal" dangerouslySetInnerHTML={{ __html: lesson.goal }} />
                <LessonRenderer blocks={lesson.blocks} />
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function BlockEditor({
  block,
  onChange,
  onMove,
  onDelete,
  canUp,
  canDown,
}: {
  block: Block;
  onChange: (b: Block) => void;
  onMove: (d: -1 | 1) => void;
  onDelete: () => void;
  canUp: boolean;
  canDown: boolean;
}) {
  const set = (patch: Partial<Block>) => onChange({ ...block, ...patch } as Block);
  return (
    <div className="panel" style={{ margin: "10px 0", padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span className="meta" style={{ margin: 0, textTransform: "uppercase" }}>{block.type}</span>
        <div className="row-btns">
          <button className="btn" disabled={!canUp} onClick={() => onMove(-1)} style={{ padding: "2px 8px" }}>↑</button>
          <button className="btn" disabled={!canDown} onClick={() => onMove(1)} style={{ padding: "2px 8px" }}>↓</button>
          <button className="btn" onClick={onDelete} style={{ padding: "2px 8px", color: "var(--bad)" }}>✕</button>
        </div>
      </div>

      {block.type === "heading" && (
        <input className="f" value={block.text} onChange={(e) => set({ text: e.target.value })} />
      )}
      {block.type === "prose" && (
        <textarea className="f" rows={3} value={block.html} onChange={(e) => set({ html: e.target.value })} />
      )}
      {block.type === "code" && (
        <>
          <textarea className="f" rows={4} style={{ fontFamily: "var(--mono)", fontSize: 12 }} value={block.code} onChange={(e) => set({ code: e.target.value })} />
          <input className="f" style={{ marginTop: 6 }} placeholder="expected output (optional)" value={block.out || ""} onChange={(e) => set({ out: e.target.value })} />
        </>
      )}
      {block.type === "callout" && (
        <>
          <select className="f" value={block.kind} onChange={(e) => set({ kind: e.target.value as any })}>
            <option value="mistake">⚠ Common mistake</option>
            <option value="tip">✓ Tip</option>
            <option value="note">◆ Note</option>
          </select>
          <input className="f" style={{ marginTop: 6 }} value={block.title} onChange={(e) => set({ title: e.target.value })} />
          <textarea className="f" rows={2} style={{ marginTop: 6 }} value={block.html} onChange={(e) => set({ html: e.target.value })} />
        </>
      )}
      {block.type === "exercise" && (
        <>
          <textarea className="f" rows={2} value={block.html} onChange={(e) => set({ html: e.target.value })} />
          <input className="f" style={{ marginTop: 6 }} placeholder="meta (e.g. checks: 3 lines)" value={block.meta || ""} onChange={(e) => set({ meta: e.target.value })} />
        </>
      )}
      {(block.type === "terms" || block.type === "check") && (
        <textarea
          className="f"
          rows={3}
          style={{ fontFamily: "var(--mono)", fontSize: 11 }}
          value={JSON.stringify((block as any).items)}
          onChange={(e) => {
            try {
              set({ items: JSON.parse(e.target.value) } as any);
            } catch {
              /* ignore invalid JSON mid-typing */
            }
          }}
        />
      )}
    </div>
  );
}
