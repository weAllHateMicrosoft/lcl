"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Stage = "creds" | "totp" | "verify" | "forgot" | "reset";

export default function LoginForm() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("creds");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [code, setCode] = useState("");
  const [newPw, setNewPw] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  function go(role: string) {
    router.push(role === "STUDENT" ? "/lessons" : "/teacher");
    router.refresh();
  }

  async function login(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, totp: totp || undefined }),
    });
    const d = await r.json();
    setBusy(false);
    if (d.totpRequired) {
      setStage("totp");
      if (d.error) setError(d.error);
      return;
    }
    if (d.verifyRequired) {
      setStage("verify");
      setInfo(`We emailed a code to ${d.email}.`);
      return;
    }
    if (!r.ok) return setError(d.error || "Sign-in failed.");
    go(d.role);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch("/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, purpose: "verify" }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setError(d.error || "Wrong code.");
    go(d.role || "STUDENT");
  }

  async function forgot(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setError(d.error || "Failed.");
    setStage("reset");
    setInfo("If that email has an account, a reset code is on its way.");
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch("/api/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code, newPassword: newPw }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setError(d.error || "Failed.");
    setStage("creds");
    setPassword("");
    setInfo("Password changed ✓ — sign in with the new one.");
  }

  const errBox = error && <div className="offline-note">✗ {error}</div>;
  const infoBox = info && <div className="notice">{info}</div>;

  if (stage === "totp")
    return (
      <form onSubmit={login}>
        {infoBox}
        <label className="field">
          <span className="l">Authenticator code <span className="hint">(Google Authenticator)</span></span>
          <input className="f codein" value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))} maxLength={6} autoFocus required />
        </label>
        {errBox}
        <button className="btn green" style={{ width: "100%" }} disabled={busy}>{busy ? "checking…" : "Verify →"}</button>
      </form>
    );

  if (stage === "verify")
    return (
      <form onSubmit={verify}>
        {infoBox}
        <label className="field">
          <span className="l">Email verification code</span>
          <input className="f codein" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} maxLength={6} autoFocus required />
        </label>
        {errBox}
        <button className="btn green" style={{ width: "100%" }} disabled={busy}>{busy ? "checking…" : "Verify & sign in →"}</button>
      </form>
    );

  if (stage === "forgot")
    return (
      <form onSubmit={forgot}>
        <label className="field">
          <span className="l">Your account email</span>
          <input className="f" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
        </label>
        {errBox}
        <button className="btn green" style={{ width: "100%" }} disabled={busy}>{busy ? "sending…" : "Email me a reset code"}</button>
        <div className="authalt"><a href="#" onClick={(e) => { e.preventDefault(); setStage("creds"); }}>← Back to sign-in</a></div>
      </form>
    );

  if (stage === "reset")
    return (
      <form onSubmit={reset}>
        {infoBox}
        <label className="field">
          <span className="l">Reset code (from your email)</span>
          <input className="f codein" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} maxLength={6} autoFocus required />
        </label>
        <label className="field">
          <span className="l">New password <span className="hint">(8+ characters)</span></span>
          <input className="f" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} minLength={8} required />
        </label>
        {errBox}
        <button className="btn green" style={{ width: "100%" }} disabled={busy}>{busy ? "saving…" : "Set new password"}</button>
      </form>
    );

  return (
    <form onSubmit={login}>
      {infoBox}
      <label className="field">
        <span className="l">Email</span>
        <input className="f" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
      </label>
      <label className="field">
        <span className="l">Password</span>
        <input className="f" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {errBox}
      <button className="btn green" style={{ width: "100%", marginTop: 8 }} disabled={busy}>
        {busy ? "signing in…" : "Sign in"}
      </button>
      <div className="authalt">
        <a href="#" onClick={(e) => { e.preventDefault(); setError(""); setInfo(""); setStage("forgot"); }}>Forgot password?</a>
      </div>
    </form>
  );
}
