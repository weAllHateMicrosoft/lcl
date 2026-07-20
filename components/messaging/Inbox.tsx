"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Convo = { userId: string; name: string; role: string; lastBody: string; lastAt: string; unread: number };
type Recipient = { id: string; name: string; role: string; sub?: string };
type Msg = { id: string; mine: boolean; body: string; at: string; kind: string; lessonCode?: string | null; edited?: boolean };

export default function Inbox({ meId }: { meId: string }) {
  const router = useRouter();
  const [convos, setConvos] = useState<Convo[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [thread, setThread] = useState<Msg[]>([]);
  const [otherName, setOtherName] = useState("");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadSummary = useCallback(async () => {
    const d = await fetch("/api/messages").then((r) => r.json());
    setConvos(d.conversations || []);
    setRecipients(d.recipients || []);
  }, []);

  const openThread = useCallback(
    async (userId: string) => {
      setActive(userId);
      const d = await fetch(`/api/messages?with=${userId}`).then((r) => r.json());
      setThread(d.messages || []);
      setOtherName(d.other?.name || recipients.find((r) => r.id === userId)?.name || "");
      loadSummary(); // refresh unread counts
      router.refresh(); // update the nav badge
    },
    [recipients, loadSummary, router]
  );

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  // light polling while a thread is open
  useEffect(() => {
    if (!active) return;
    const t = setInterval(async () => {
      const d = await fetch(`/api/messages?with=${active}`).then((r) => r.json());
      setThread(d.messages || []);
    }, 15000);
    return () => clearInterval(t);
  }, [active]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [thread]);

  async function saveEdit() {
    if (!editing) return;
    const { id, text } = editing;
    setEditing(null);
    if (text.trim()) {
      await fetch("/api/messages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, body: text }) });
      openThread(active!);
    }
  }

  async function doDelete(id: string) {
    setConfirmDel(null);
    await fetch("/api/messages", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    openThread(active!);
  }

  async function send() {
    if (!draft.trim() || !active) return;
    const body = draft;
    setDraft("");
    setThread((t) => [...t, { id: "tmp" + Date.now(), mine: true, body, at: new Date().toISOString(), kind: "dm" }]);
    await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toId: active, body }) });
    openThread(active);
  }

  return (
    <div className="inbox">
      <aside className="convos">
        <div className="newmsg">
          <select value="" onChange={(e) => e.target.value && openThread(e.target.value)}>
            <option value="">✎ New message…</option>
            {recipients.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} {r.sub ? `· ${r.sub}` : ""}
              </option>
            ))}
          </select>
        </div>
        {convos.length === 0 && <p style={{ color: "var(--muted)", fontSize: 13, padding: "10px 12px" }}>No conversations yet.</p>}
        {convos.map((c) => (
          <button key={c.userId} className={`convo ${active === c.userId ? "on" : ""}`} onClick={() => openThread(c.userId)}>
            <div className="crow">
              <b>{c.name}</b>
              {c.unread > 0 && <span className="ubadge">{c.unread}</span>}
            </div>
            <div className="cprev">{c.lastBody}</div>
          </button>
        ))}
      </aside>

      <section className="thread">
        {!active ? (
          <div className="empty">Pick a conversation, or start a new one.</div>
        ) : (
          <>
            <div className="thead">{otherName}</div>
            <div className="tmsgs" ref={scrollRef}>
              {thread.map((m) =>
                editing?.id === m.id ? (
                  <div key={m.id} className={`msg ${m.mine ? "u" : "a"}`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <textarea
                      className="f"
                      rows={2}
                      value={editing.text}
                      autoFocus
                      onChange={(e) => setEditing({ id: m.id, text: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          saveEdit();
                        }
                        if (e.key === "Escape") setEditing(null);
                      }}
                    />
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn green" style={{ padding: "4px 10px", fontSize: 12 }} onClick={saveEdit}>Save</button>
                      <button className="tbtn2" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className={`msg ${m.mine ? "u" : "a"} msgrow`}>
                    {m.body}
                    {m.lessonCode && (
                      <a className="lessonref" href={`/lessons/${m.lessonCode}`} target="_blank" rel="noopener">
                        ↗ open lesson {m.lessonCode}
                      </a>
                    )}
                    <span className="meta">
                      {new Date(m.at).toLocaleString()}
                      {m.edited ? " · edited" : ""}
                    </span>
                    {m.mine && !m.id.startsWith("tmp") && (
                      <span className="msgacts">
                        <button title="Edit" onClick={() => setEditing({ id: m.id, text: m.body })}>✎</button>
                        <button title="Delete" onClick={() => setConfirmDel(m.id)}>✕</button>
                      </span>
                    )}
                  </div>
                )
              )}
            </div>
            {confirmDel && (
              <div className="confirmbar">
                Delete this message?
                <button className="btn orange" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => doDelete(confirmDel)}>Delete</button>
                <button className="tbtn2" onClick={() => setConfirmDel(null)}>Cancel</button>
              </div>
            )}
            <div className="askrow" style={{ padding: 12, borderTop: "1.5px solid var(--line)" }}>
              <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Write a message…" />
              <button className="btn" onClick={send}>Send</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
