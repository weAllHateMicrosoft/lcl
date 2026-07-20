"use client";

// Google Authenticator (TOTP) enrollment for staff. Shows a setup key + link;
// verifying one code from the app turns 2FA on. Sign-ins then require a code.
import { useState } from "react";

export default function TotpSetup({ enabled: initialEnabled }: { enabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function begin() {
    const d = await fetch("/api/auth/totp").then((r) => r.json());
    if (d.secret) setSetup({ secret: d.secret, uri: d.uri });
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/auth/totp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret: setup?.secret, code }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: d.error || "Failed." });
    setEnabled(true);
    setSetup(null);
    setCode("");
    setMsg({ ok: true, text: "2FA is ON — sign-ins now require your authenticator code. Don't delete the app entry!" });
  }

  async function disable(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/auth/totp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ disable: true, code }) });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setMsg({ ok: false, text: d.error || "Failed." });
    setEnabled(false);
    setCode("");
    setMsg({ ok: true, text: "2FA is off." });
  }

  return (
    <div>
      {msg && <div className={msg.ok ? "notice" : "offline-note"}>{msg.text}</div>}

      {enabled ? (
        <form onSubmit={disable} className="runrow">
          <span className="statuschip live">2FA ON</span>
          <input className="f codein" style={{ maxWidth: 140 }} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} maxLength={6} placeholder="123456" />
          <button className="btn ghost" disabled={busy}>Turn off</button>
        </form>
      ) : setup ? (
        <form onSubmit={confirm}>
          <ol style={{ margin: "0 0 10px 20px", lineHeight: 1.9, fontSize: 14 }}>
            <li>Open <b>Google Authenticator</b> → + → <b>Enter a setup key</b>.</li>
            <li>Account: <code>classOS</code> · Key: <code style={{ userSelect: "all" }}>{setup.secret}</code> (time-based)</li>
            <li>Type the 6-digit code it shows:</li>
          </ol>
          <div className="runrow">
            <input className="f codein" style={{ maxWidth: 160 }} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} maxLength={6} autoFocus required />
            <button className="btn green" disabled={busy}>{busy ? "checking…" : "Verify & enable"}</button>
            <button type="button" className="btn ghost" onClick={() => setSetup(null)}>Cancel</button>
          </div>
          <p className="meta">Or copy this into any authenticator app: <code style={{ userSelect: "all", fontSize: 10 }}>{setup.uri}</code></p>
        </form>
      ) : (
        <div className="runrow">
          <span className="statuschip draft">2FA OFF</span>
          <button className="btn" onClick={begin}>Set up Google Authenticator</button>
        </div>
      )}
      <p className="meta" style={{ marginTop: 8 }}>
        ⚠ If you lose the authenticator, you can't sign in — another admin (or a database fix) must disable it for you.
      </p>
    </div>
  );
}
