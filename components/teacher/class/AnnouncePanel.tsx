"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AnnouncePanel({ classId, googleLinked, posts }: { classId: string; googleLinked: boolean; posts: { body: string; at: string }[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function post() {
    if (!text.trim()) return;
    setBusy(true);
    const d = await fetch("/api/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "announce", classId, text }) }).then((r) => r.json());
    setBusy(false);
    if (d.error) return setMsg(d.error);
    setText("");
    setMsg(`Posted to ${d.sent} inboxes${d.google ? (d.google.posted ? " + Google Classroom ✓" : ` (Google failed: ${d.google.error})`) : ""}.`);
    router.refresh();
  }

  return (
    <>
      <div className="panel">
        <h2>Post an announcement</h2>
        <p style={{ fontSize: 14 }}>Goes to every student's classOS inbox{googleLinked ? " and the Google Classroom stream" : ""}.</p>
        <textarea className="f" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Reminder: the While Loops quiz closes Friday…" />
        <div className="runrow">
          <button className="btn green" onClick={post} disabled={busy || !text.trim()}>{busy ? "posting…" : "Post"}</button>
          {msg && <span className="meta" style={{ margin: 0 }}>{msg}</span>}
        </div>
      </div>

      <div className="panel">
        <h2>Recent</h2>
        {posts.length === 0 && <p style={{ color: "var(--muted)", fontSize: 14 }}>No announcements yet.</p>}
        {posts.map((p, i) => (
          <div key={i} style={{ padding: "8px 0", borderBottom: "1px dashed var(--line)" }}>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 14 }}>{p.body}</div>
            <div className="meta" style={{ margin: "3px 0 0" }}>{new Date(p.at).toLocaleString()}</div>
          </div>
        ))}
      </div>
    </>
  );
}
