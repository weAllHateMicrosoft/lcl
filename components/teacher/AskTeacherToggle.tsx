"use client";

import { useState } from "react";

// Opt-in: when ON, students who highlight lesson text see "✉ Ask <you>" next
// to "Ask AI", and those questions arrive in your inbox with a lesson link.
export default function AskTeacherToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function toggle() {
    const next = !on;
    setOn(next);
    setSaving(true);
    await fetch("/api/prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ askTeacher: next }) });
    setSaving(false);
  }

  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13.5 }}>
      <input type="checkbox" checked={on} onChange={toggle} disabled={saving} style={{ width: 16, height: 16 }} />
      <span>
        <b>“Ask teacher” on highlight</b> — students can send you a highlighted lesson passage + question straight to your
        inbox. {on ? "Currently ON." : "Currently off — students only see “Ask AI”."}
      </span>
    </label>
  );
}
