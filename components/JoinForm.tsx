"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch("/api/auth/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, name }),
    });
    const d = await r.json();
    if (!r.ok) {
      setError(d.error || "Couldn't join.");
      setBusy(false);
      return;
    }
    router.push("/lessons");
    router.refresh();
  }

  return (
    <form onSubmit={submit}>
      <label className="field">
        <span className="l">Class code</span>
        <input
          className="f codein"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="e.g. XK4M2P"
          maxLength={8}
          autoFocus
          required
        />
      </label>
      <label className="field">
        <span className="l">Your name</span>
        <input className="f" value={name} onChange={(e) => setName(e.target.value)} placeholder="First name + last initial, e.g. Ada L." required />
      </label>
      {error && <div className="offline-note">✗ {error}</div>}
      <button className="btn green" style={{ width: "100%", marginTop: 8 }} disabled={busy}>
        {busy ? "joining…" : "Join class →"}
      </button>
    </form>
  );
}
