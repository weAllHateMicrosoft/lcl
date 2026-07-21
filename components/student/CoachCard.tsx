"use client";

import { useState } from "react";

// The student-facing AI coach note. Warm, honest, refreshable (rate-limited
// server-side so it can't burn quota).
export default function CoachCard({
  studentId,
  initial,
}: {
  studentId: string;
  initial: { message: string; at: string; stale: boolean } | null;
}) {
  const [note, setNote] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function refresh() {
    setBusy(true);
    setErr("");
    const d = await fetch("/api/oversee", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId }) }).then((r) => r.json());
    if (d.insight?.studentMessage) setNote({ message: d.insight.studentMessage, at: d.createdAt, stale: false });
    else if (d.error) setErr(d.error);
    setBusy(false);
  }

  return (
    <div className="panel" style={{ borderColor: "var(--violet)", padding: "14px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <b style={{ fontFamily: "var(--serif)", fontSize: 16 }}>✦ Your coach</b>
        <span style={{ flex: 1 }} />
        {note && <span className="meta" style={{ margin: 0 }}>{new Date(note.at).toLocaleDateString()}</span>}
        <button className="btn ghost" style={{ padding: "4px 10px" }} disabled={busy} onClick={refresh}>
          {busy ? "thinking…" : note ? (note.stale ? "✦ Update (you've done new work)" : "✦ Update") : "✦ Get my first note"}
        </button>
      </div>
      {note ? (
        <p style={{ margin: "8px 0 0", fontSize: 14.5, lineHeight: 1.55 }}>{note.message}</p>
      ) : (
        <p className="meta" style={{ marginTop: 8 }}>Your coach reads your actual work — lessons, answers, questions you ask — and leaves you a short note with your next step.</p>
      )}
      {err && <p className="meta" style={{ marginTop: 6, color: "#b3352e" }}>{err}</p>}
    </div>
  );
}
