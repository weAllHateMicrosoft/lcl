"use client";

// The lesson editor, v2 — edit while previewing.
//
// The lesson renders exactly as students see it, and every piece is editable in
// place: click into text and type (Google-Docs style, with a floating B/I/code
// bar on selection), hover a block for its tools (drag ⠿, delete, kind), hover
// between blocks for a "+" insert point. All edits autosave to a DRAFT —
// students keep seeing the last published version until you hit Publish, and
// every publish snapshots the old version into a restorable History.

import { useEffect, useRef, useState } from "react";
import type { Block } from "@/lib/curriculum/blocks";

type WBlock = { uid: string; b: Block };
type Working = { title: string; goal: string; blocks: WBlock[]; exercise: any; quizBank: any[] };
type Lesson = { id: string; code: string; title: string; goal: string; blocks: Block[]; exercise: any; quizBank: any[]; draft: any; draftAt: string | null };
type Chapter = { id: string; title: string; order: number; lessons: Lesson[] };

const uid = () => Math.random().toString(36).slice(2, 10);
const BLOCK_TYPES: { label: string; make: () => Block }[] = [
  { label: "¶ Paragraph", make: () => ({ type: "prose", html: "" }) },
  { label: "H Heading", make: () => ({ type: "heading", text: "New section" }) },
  { label: "{} Code", make: () => ({ type: "code", code: "// code", out: "" }) },
  { label: "⚠ Callout", make: () => ({ type: "callout", kind: "mistake", title: "Common mistake", html: "" }) },
  { label: "≔ Terms", make: () => ({ type: "terms", items: [["term", "definition"]] }) },
  { label: "? Check", make: () => ({ type: "check", items: [["Question?", "Answer."]] }) },
  { label: "✎ Try it", make: () => ({ type: "exercise", html: "Try this…", meta: "" }) },
];

async function api(method: "PUT" | "POST", body: unknown) {
  const r = await fetch("/api/curriculum", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return r.json();
}

export default function Editor() {
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [sel, setSel] = useState<{ c: number; l: number }>({ c: 0, l: 0 });
  const [working, setWorking] = useState<Working | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [saveState, setSaveState] = useState("");
  const [histOpen, setHistOpen] = useState(false);
  const [versions, setVersions] = useState<{ id: string; publishedAt: string; blockCount: number }[]>([]);
  const [fmt, setFmt] = useState<{ x: number; y: number } | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [armed, setArmed] = useState<number | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workingRef = useRef(working);
  workingRef.current = working;
  const lessonRef = useRef<Lesson | null>(null);

  useEffect(() => {
    reload();
  }, []);

  async function reload(keepSel?: { c: number; l: number }) {
    const d = await fetch("/api/curriculum").then((r) => r.json());
    const tree: Chapter[] = d.chapters || [];
    setChapters(tree);
    const s = keepSel ?? sel;
    const safe = { c: Math.min(s.c, tree.length - 1), l: 0 };
    safe.l = Math.min(s.l, (tree[safe.c]?.lessons.length ?? 1) - 1);
    setSel(safe);
    loadWorking(tree, safe);
  }

  function loadWorking(tree: Chapter[], s: { c: number; l: number }) {
    const lesson = tree[s.c]?.lessons[s.l];
    lessonRef.current = lesson ?? null;
    if (!lesson) return setWorking(null);
    const src = lesson.draft ?? { title: lesson.title, goal: lesson.goal, blocks: lesson.blocks, exercise: lesson.exercise, quizBank: lesson.quizBank };
    setHasDraft(Boolean(lesson.draft));
    setWorking({
      title: src.title ?? "",
      goal: src.goal ?? "",
      blocks: (src.blocks ?? []).map((b: Block) => ({ uid: uid(), b })),
      exercise: src.exercise ?? {},
      quizBank: src.quizBank ?? [],
    });
    setHistOpen(false);
    setSaveState(lesson.draft ? "draft loaded" : "");
  }

  function selectLesson(c: number, l: number) {
    setSel({ c, l });
    loadWorking(chapters, { c, l });
  }

  /* ── draft autosave ── */
  function mutate(fn: (w: Working) => void) {
    setWorking((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
    setHasDraft(true);
    setSaveState("saving draft…");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const w = workingRef.current;
      const lesson = lessonRef.current;
      if (!w || !lesson) return;
      await api("PUT", {
        id: lesson.id,
        draft: { title: w.title, goal: w.goal, blocks: w.blocks.map((x) => x.b), exercise: w.exercise, quizBank: w.quizBank },
      });
      setSaveState("draft saved ✓");
    }, 800);
  }

  /* ── publish / discard / history ── */
  async function publish() {
    const lesson = lessonRef.current;
    if (!lesson) return;
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      const w = workingRef.current!;
      await api("PUT", { id: lesson.id, draft: { title: w.title, goal: w.goal, blocks: w.blocks.map((x) => x.b), exercise: w.exercise, quizBank: w.quizBank } });
    }
    await api("POST", { action: "publish", lessonId: lesson.id });
    await reload(sel);
    setSaveState("published ✓ — students see this now");
  }

  async function discard() {
    const lesson = lessonRef.current;
    if (!lesson) return;
    if (!confirm("Throw away all unpublished changes and go back to the live version?")) return;
    await api("POST", { action: "discardDraft", lessonId: lesson.id });
    await reload(sel);
  }

  async function toggleHistory() {
    const lesson = lessonRef.current;
    if (!lesson) return;
    if (!histOpen) {
      const d = await fetch(`/api/curriculum/versions?lessonId=${lesson.id}`).then((r) => r.json());
      setVersions(d.versions || []);
    }
    setHistOpen(!histOpen);
  }

  async function restore(versionId: string) {
    await api("POST", { action: "restoreVersion", versionId });
    await reload(sel);
    setSaveState("version restored into draft — publish to make it live");
  }

  /* ── selection format bar (B / I / code) ── */
  function trackSelection() {
    const s = window.getSelection();
    if (!s || s.isCollapsed || !s.anchorNode) return setFmt(null);
    const el = s.anchorNode.parentElement?.closest("[contenteditable]");
    if (!el) return setFmt(null);
    const rect = s.getRangeAt(0).getBoundingClientRect();
    setFmt({ x: rect.left + rect.width / 2 - 50, y: rect.top - 36 });
  }

  function applyFmt(cmd: "bold" | "italic" | "code") {
    if (cmd === "code") {
      const s = window.getSelection();
      if (s && !s.isCollapsed) document.execCommand("insertHTML", false, `<code>${s.toString()}</code>`);
    } else {
      document.execCommand(cmd);
    }
    setFmt(null);
  }

  /* ── block ops ── */
  const insertAt = (i: number, make: () => Block) => mutate((w) => w.blocks.splice(i, 0, { uid: uid(), b: make() }));
  const removeAt = (i: number) => mutate((w) => w.blocks.splice(i, 1));
  const setBlock = (i: number, b: Block) => mutate((w) => (w.blocks[i] = { ...w.blocks[i], b }));
  function onDrop(to: number) {
    if (dragIdx !== null && dragIdx !== to) {
      mutate((w) => {
        const [m] = w.blocks.splice(dragIdx, 1);
        w.blocks.splice(to > dragIdx ? to - 1 : to, 0, m);
      });
    }
    setDragIdx(null);
    setOverIdx(null);
    setArmed(null);
  }

  const lesson = lessonRef.current;

  return (
    <div className="shell" onMouseUp={trackSelection} onKeyUp={trackSelection}>
      {fmt && (
        <div className="fmtbar" style={{ left: fmt.x, top: fmt.y }}>
          <button onMouseDown={(e) => { e.preventDefault(); applyFmt("bold"); }}><b>B</b></button>
          <button onMouseDown={(e) => { e.preventDefault(); applyFmt("italic"); }}><i>I</i></button>
          <button onMouseDown={(e) => { e.preventDefault(); applyFmt("code"); }} style={{ fontFamily: "var(--mono)" }}>{"</>"}</button>
        </div>
      )}

      {/* ── curriculum tree ── */}
      <nav className="ednav">
        {chapters.map((c, ci) => (
          <div className="chap" key={c.id}>
            <div className="chaphead">
              <input
                defaultValue={c.title}
                onBlur={(e) => e.target.value !== c.title && api("POST", { action: "renameChapter", chapterId: c.id, title: e.target.value })}
              />
            </div>
            {c.lessons.map((l, li) => (
              <button key={l.id} className={`lrow ${ci === sel.c && li === sel.l ? "on" : ""}`} onClick={() => selectLesson(ci, li)}>
                <span className="num">{l.code}</span> {l.draft?.title ?? l.title}
                {l.draft && <span className="draftdot" title="has unpublished draft" />}
              </button>
            ))}
            <button
              className="addbtn"
              onClick={async () => {
                await api("POST", { action: "addLesson", chapterId: c.id });
                reload({ c: ci, l: c.lessons.length });
              }}
            >
              + Add lesson
            </button>
          </div>
        ))}
        <button className="addbtn" onClick={async () => { await api("POST", { action: "addChapter" }); reload(); }}>
          + Add chapter
        </button>
      </nav>

      {/* ── the lesson, editable in place ── */}
      <main className="edmain">
        {!working || !lesson ? (
          <p>Loading…</p>
        ) : (
          <>
            <div className="edbar">
              <span className={`statuschip ${hasDraft ? "draft" : "live"}`}>{hasDraft ? "● DRAFT" : "✓ PUBLISHED"}</span>
              <span className="save">{saveState || (hasDraft ? "students see the last published version" : "this is what students see")}</span>
              <span style={{ flex: 1 }} />
              {hasDraft && (
                <>
                  <button className="btn green" onClick={publish}>Publish</button>
                  <button className="btn ghost" onClick={discard}>Discard draft</button>
                </>
              )}
              <button className="btn ghost" onClick={toggleHistory}>History</button>
              <button className="btn ghost" onClick={async () => { await api("POST", { action: "duplicateLesson", lessonId: lesson.id }); reload(); }}>Duplicate</button>
              <button
                className="btn orange"
                onClick={async () => {
                  if (!confirm(`Delete lesson ${lesson.code}? This also removes its attempts and history.`)) return;
                  await api("POST", { action: "deleteLesson", lessonId: lesson.id });
                  reload({ c: sel.c, l: 0 });
                }}
              >
                Delete
              </button>
            </div>

            {histOpen && (
              <div className="histpanel">
                <b style={{ fontFamily: "var(--serif)" }}>History — one snapshot per publish</b>
                {versions.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13, margin: "8px 0 0" }}>No published versions yet.</p>}
                {versions.map((v) => (
                  <div className="vrow" key={v.id}>
                    <span>{new Date(v.publishedAt).toLocaleString()}</span>
                    <span style={{ color: "var(--muted)" }}>{v.blockCount} blocks</span>
                    <span style={{ flex: 1 }} />
                    <button className="btn ghost" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => restore(v.id)}>
                      Restore → draft
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="lesson pv">
              <InlineHtml key={`t-${lesson.id}`} html={working.title} onChange={(h) => mutate((w) => (w.title = h))} className="" tagStyle="title" placeholder="Lesson title…" />
              <InlineHtml key={`g-${lesson.id}`} html={working.goal} onChange={(h) => mutate((w) => (w.goal = h))} className="goalbox" placeholder="Goal — one sentence students see in the green box…" />

              <InsertRow onPick={(make) => insertAt(0, make)} />
              {working.blocks.map((wb, i) => (
                <div key={wb.uid}>
                  <div
                    className={`edblk ${dragIdx === i ? "dragging" : ""} ${overIdx === i ? "dragover" : ""}`}
                    draggable={armed === i}
                    onDragStart={() => setDragIdx(i)}
                    onDragEnd={() => { setDragIdx(null); setOverIdx(null); setArmed(null); }}
                    onDragOver={(e) => { e.preventDefault(); setOverIdx(i); }}
                    onDrop={() => onDrop(i)}
                  >
                    <div className="blktools">
                      <button className="grip" title="Drag to move" onMouseDown={() => setArmed(i)}>⠿</button>
                      {wb.b.type === "callout" && (
                        <select value={wb.b.kind} onChange={(e) => setBlock(i, { ...wb.b, kind: e.target.value as any })}>
                          <option value="mistake">⚠</option>
                          <option value="tip">✓</option>
                          <option value="note">◆</option>
                        </select>
                      )}
                      <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--muted)", alignSelf: "center", padding: "0 3px" }}>{wb.b.type}</span>
                      <button className="del" title="Delete block" onClick={() => removeAt(i)}>✕</button>
                    </div>
                    <EditableBlock block={wb.b} uid={wb.uid} onChange={(b) => setBlock(i, b)} />
                  </div>
                  <InsertRow onPick={(make) => insertAt(i + 1, make)} />
                </div>
              ))}
            </div>

            <ExerciseAndQuiz working={working} mutate={mutate} />
          </>
        )}
      </main>
    </div>
  );
}

/* ── uncontrolled contentEditable that never fights the cursor ────────── */
function InlineHtml({
  html,
  onChange,
  className,
  placeholder,
  tagStyle,
}: {
  html: string;
  onChange: (h: string) => void;
  className: string;
  placeholder?: string;
  tagStyle?: "title";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = html;
    // set once on mount only — typing must never be overwritten by React
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={tagStyle === "title" ? { fontFamily: "var(--serif)", fontWeight: 900, fontSize: 30, lineHeight: 1.1, marginBottom: 8 } : undefined}
      contentEditable
      suppressContentEditableWarning
      data-ph={placeholder}
      onInput={() => onChange(ref.current!.innerHTML)}
    />
  );
}

/* ── "+" insert point between blocks ───────────────────────────────────── */
function InsertRow({ onPick }: { onPick: (make: () => Block) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`insrow ${open ? "open" : ""}`}>
      <div className="line" />
      {!open ? (
        <button className="plus" title="Insert block here" onClick={() => setOpen(true)}>+</button>
      ) : (
        <div className="insmenu">
          {BLOCK_TYPES.map((t) => (
            <button key={t.label} onClick={() => { onPick(t.make); setOpen(false); }}>{t.label}</button>
          ))}
          <button onClick={() => setOpen(false)}>✕</button>
        </div>
      )}
      <div className="line" />
    </div>
  );
}

/* ── each block rendered as students see it, editable in place ─────────── */
function EditableBlock({ block: b, uid: key, onChange }: { block: Block; uid: string; onChange: (b: Block) => void }) {
  switch (b.type) {
    case "heading":
      return <InlineHtml key={key} html={b.text} onChange={(h) => onChange({ ...b, text: h.replace(/<[^>]+>/g, "") })} className="edh2" placeholder="Heading…" />;
    case "prose":
      return <InlineHtml key={key} html={b.html} onChange={(h) => onChange({ ...b, html: h })} className="" placeholder="Write a paragraph… (select text for B / I / code)" />;
    case "code":
      return (
        <div className="codeblock">
          <textarea
            className="codeedit"
            defaultValue={b.code}
            rows={Math.max(2, b.code.split("\n").length)}
            onChange={(e) => onChange({ ...b, code: e.target.value })}
            spellCheck={false}
          />
          <div className="outedit">
            <span className="lbl">OUTPUT</span>
            <textarea defaultValue={b.out || ""} rows={Math.max(1, (b.out || "").split("\n").length)} placeholder="(expected output — optional)" onChange={(e) => onChange({ ...b, out: e.target.value })} spellCheck={false} />
          </div>
        </div>
      );
    case "callout":
      return (
        <div className={`callout ${b.kind}`}>
          <InlineHtml key={key + "t"} html={b.title} onChange={(h) => onChange({ ...b, title: h.replace(/<[^>]+>/g, "") })} className="ch" placeholder="Callout title…" />
          <InlineHtml key={key + "b"} html={b.html} onChange={(h) => onChange({ ...b, html: h })} className="" placeholder="Callout body…" />
        </div>
      );
    case "terms":
      return (
        <div className="terms">
          {b.items.map(([k, v], i) => (
            <div className="row" key={`${key}-${i}`} style={{ position: "relative" }}>
              <InlineHtml key={`${key}-${i}k`} html={k} onChange={(h) => onChange({ ...b, items: b.items.map((it, j) => (j === i ? [h.replace(/<[^>]+>/g, ""), it[1]] : it)) as any })} className="k" placeholder="term" />
              <InlineHtml key={`${key}-${i}v`} html={v} onChange={(h) => onChange({ ...b, items: b.items.map((it, j) => (j === i ? [it[0], h] : it)) as any })} className="v" placeholder="definition" />
              <button className="rowdel" style={{ position: "absolute", right: 4, top: 8, border: "none", background: "none", color: "var(--muted)", cursor: "pointer" }} onClick={() => onChange({ ...b, items: b.items.filter((_, j) => j !== i) as any })}>✕</button>
            </div>
          ))}
          <button className="addbtn" style={{ margin: 6, width: "auto" }} onClick={() => onChange({ ...b, items: [...b.items, ["", ""]] as any })}>+ row</button>
        </div>
      );
    case "check":
      return (
        <div className="check">
          {b.items.map(([q, a], i) => (
            <div key={`${key}-${i}`} style={{ padding: "9px 0", borderTop: i ? "1px dashed var(--line)" : "none", position: "relative" }}>
              <InlineHtml key={`${key}-${i}q`} html={q} onChange={(h) => onChange({ ...b, items: b.items.map((it, j) => (j === i ? [h, it[1]] : it)) as any })} className="" placeholder="Concept-check question…" />
              <InlineHtml key={`${key}-${i}a`} html={a} onChange={(h) => onChange({ ...b, items: b.items.map((it, j) => (j === i ? [it[0], h] : it)) as any })} className="ans" placeholder="Answer (students reveal it)…" />
              <button style={{ position: "absolute", right: 0, top: 10, border: "none", background: "none", color: "var(--muted)", cursor: "pointer" }} onClick={() => onChange({ ...b, items: b.items.filter((_, j) => j !== i) as any })}>✕</button>
            </div>
          ))}
          <button className="addbtn" style={{ margin: "6px 0", width: "auto" }} onClick={() => onChange({ ...b, items: [...b.items, ["", ""]] as any })}>+ question</button>
        </div>
      );
    case "exercise":
      return (
        <div className="tryit">
          <div className="ch">✎ Try it</div>
          <InlineHtml key={key} html={b.html} onChange={(h) => onChange({ ...b, html: h })} className="" placeholder="Exercise prompt…" />
          <input className="f" style={{ marginTop: 8, fontFamily: "var(--mono)", fontSize: 11 }} defaultValue={b.meta || ""} placeholder="meta, e.g. checks: 3 lines of output" onChange={(e) => onChange({ ...b, meta: e.target.value })} />
        </div>
      );
    default:
      return null;
  }
}

/* ── graded exercise + quiz bank (structured, also drafted) ────────────── */
function ExerciseAndQuiz({ working, mutate }: { working: Working; mutate: (fn: (w: Working) => void) => void }) {
  const ex = working.exercise || {};
  const bank = working.quizBank || [];
  return (
    <>
      <details className="histpanel" style={{ marginTop: 24 }} open={Boolean(ex.prompt)}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>
          Graded coding exercise {ex.prompt ? "" : "— empty (panel hidden for students)"}
        </summary>
        <div style={{ marginTop: 10 }}>
          <div className="blk"><div className="bb">
            <div className="lbl">Prompt</div>
            <textarea rows={2} defaultValue={ex.prompt || ""} onChange={(e) => mutate((w) => (w.exercise = { ...w.exercise, prompt: e.target.value }))} />
            <div className="lbl">Starter code</div>
            <textarea className="monoarea" defaultValue={ex.starter || ""} onChange={(e) => mutate((w) => (w.exercise = { ...w.exercise, starter: e.target.value }))} />
            <div className="lbl">Expected output (rule-based verdict)</div>
            <textarea rows={2} defaultValue={ex.expected || ""} onChange={(e) => mutate((w) => (w.exercise = { ...w.exercise, expected: e.target.value }))} />
            <div className="lbl">Expected behaviour (plain English — guides AI coaching)</div>
            <input className="f" defaultValue={ex.behaviour || ""} onChange={(e) => mutate((w) => (w.exercise = { ...w.exercise, behaviour: e.target.value }))} />
            <div className="lbl">stdin fed to the program (optional)</div>
            <input className="f" defaultValue={ex.stdin || ""} onChange={(e) => mutate((w) => (w.exercise = { ...w.exercise, stdin: e.target.value }))} />
          </div></div>
        </div>
      </details>

      <details className="histpanel" open={bank.length > 0}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>
          Quiz bank — {bank.length} questions {bank.length === 0 ? "(practice + clean quiz hidden)" : "(feeds practice + clean quiz)"}
        </summary>
        <div style={{ marginTop: 10 }}>
          {bank.map((q: any, qi: number) => (
            <div key={qi} style={{ borderBottom: "1px dashed var(--line)", paddingBottom: 12, marginBottom: 12 }}>
              <div className="itemrow">
                <input className="f" style={{ flex: 1 }} defaultValue={q.q} placeholder="Question (HTML ok)" onChange={(e) => mutate((w) => (w.quizBank[qi].q = e.target.value))} />
                <button onClick={() => mutate((w) => w.quizBank.splice(qi, 1))}>✕</button>
              </div>
              {(q.opts || []).map((opt: string, oi: number) => (
                <div className="itemrow" key={oi}>
                  <input type="radio" style={{ width: 20, flex: "0 0 20px" }} checked={q.correct === oi} onChange={() => mutate((w) => (w.quizBank[qi].correct = oi))} title="Correct answer" />
                  <input className="f" defaultValue={opt} placeholder={`Option ${"ABCD"[oi] || oi + 1}`} onChange={(e) => mutate((w) => (w.quizBank[qi].opts[oi] = e.target.value))} />
                </div>
              ))}
              <input className="f" defaultValue={q.why || ""} placeholder="Why (one-line explanation)" onChange={(e) => mutate((w) => (w.quizBank[qi].why = e.target.value))} />
            </div>
          ))}
          <button className="addbtn" onClick={() => mutate((w) => w.quizBank.push({ q: "", opts: ["", "", "", ""], correct: 0, why: "" }))}>+ question</button>
        </div>
      </details>
    </>
  );
}
