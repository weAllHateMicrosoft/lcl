"use client";

import { useState } from "react";

export default function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/auth/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ current, next }),
    });
    const d = await r.json();
    setMsg(r.ok ? { ok: true, text: "Password changed ✓" } : { ok: false, text: d.error || "Failed." });
    if (r.ok) {
      setCurrent("");
      setNext("");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit}>
      <label className="field">
        <span className="l">Current password</span>
        <input className="f" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </label>
      <label className="field">
        <span className="l">New password <span className="hint">(8+ characters)</span></span>
        <input className="f" type="password" value={next} onChange={(e) => setNext(e.target.value)} minLength={8} required />
      </label>
      {msg && <div className={msg.ok ? "notice" : "offline-note"}>{msg.text}</div>}
      <button className="btn green" disabled={busy}>{busy ? "saving…" : "Change password"}</button>
    </form>
  );
}
