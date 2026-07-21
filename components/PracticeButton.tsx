"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PracticeButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function start() {
    setBusy(true);
    setError("");
    const r = await fetch("/api/auth/practice", { method: "POST" });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setError(d.error || "Couldn't start — try again.");
    router.push("/lessons");
    router.refresh();
  }

  return (
    <div>
      <button className="btn green" style={{ width: "100%", fontSize: 15, padding: "12px 0" }} onClick={start} disabled={busy}>
        {busy ? "setting up…" : "Start practicing →"}
      </button>
      <p className="meta" style={{ marginTop: 8, textAlign: "center" }}>
        No name, no email, no signup. Just you and the lessons — your progress stays on this device.
      </p>
      {error && <div className="offline-note">✗ {error}</div>}
    </div>
  );
}
