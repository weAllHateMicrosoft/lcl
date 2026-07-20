"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinForm() {
  const router = useRouter();
  const [stage, setStage] = useState<"form" | "code">("form");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch("/api/auth/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, name, email, password }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setError(d.error || "Couldn't join.");
    if (d.pending) return setStage("code"); // code emailed
    router.push("/lessons");
    router.refresh();
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code: emailCode, purpose: "join" }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setError(d.error || "Wrong code.");
    router.push("/lessons");
    router.refresh();
  }

  if (stage === "code") {
    return (
      <form onSubmit={verify}>
        <div className="notice">📬 We emailed a 6-digit code to <b>{email}</b>. Check your inbox (and spam).</div>
        <label className="field">
          <span className="l">Verification code</span>
          <input className="f codein" value={emailCode} onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ""))} maxLength={6} autoFocus required />
        </label>
        {error && <div className="offline-note">✗ {error}</div>}
        <button className="btn green" style={{ width: "100%", marginTop: 8 }} disabled={busy}>
          {busy ? "checking…" : "Verify & join →"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={submit}>
      <label className="field">
        <span className="l">Class code</span>
        <input className="f codein" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. XK4M2P" maxLength={8} autoFocus required />
      </label>
      <label className="field">
        <span className="l">Your name</span>
        <input className="f" value={name} onChange={(e) => setName(e.target.value)} placeholder="First name + last initial, e.g. Ada L." required />
      </label>
      <label className="field">
        <span className="l">Email <span className="hint">(your real one — we'll send a code)</span></span>
        <input className="f" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@gmail.com" required />
      </label>
      <label className="field">
        <span className="l">Choose a password <span className="hint">(8+ characters)</span></span>
        <input className="f" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
      </label>
      {error && <div className="offline-note">✗ {error}</div>}
      <button className="btn green" style={{ width: "100%", marginTop: 8 }} disabled={busy}>
        {busy ? "joining…" : "Join class →"}
      </button>
    </form>
  );
}
