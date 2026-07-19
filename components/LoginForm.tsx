"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.error || "Sign-in failed.");
      setBusy(false);
      return;
    }
    router.push(d.role === "STUDENT" ? "/lessons" : "/teacher");
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <label className="field">
        <span className="l">Email</span>
        <input className="f" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
      </label>
      <label className="field">
        <span className="l">Password</span>
        <input className="f" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {error && <div className="offline-note">✗ {error}</div>}
      <button className="btn green" style={{ width: "100%", marginTop: 8 }} disabled={busy}>
        {busy ? "signing in…" : "Sign in"}
      </button>
    </form>
  );
}
