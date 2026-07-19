"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type ClassInfo = { id: string; name: string; joinCode: string; studentCount: number };

// Teacher's classes: join codes big and readable (they go on the board), plus
// a create form. Students join at /join with the code + their name.
export default function ClassManager({ classes }: { classes: ClassInfo[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError("");
    const r = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!r.ok) setError((await r.json()).error || "Failed.");
    else setName("");
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="panel" style={{ marginBottom: 22 }}>
      <h2>
        Your classes <span className="tag k">JOIN CODES</span>
      </h2>
      {classes.length === 0 && (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>
          No classes yet — create one below, then put its code on the board. Students join at <code>/join</code>.
        </p>
      )}
      {classes.map((c) => (
        <div key={c.id} className="test" style={{ alignItems: "center" }}>
          <span style={{ fontFamily: "var(--sans)", fontWeight: 700, fontSize: 14 }}>{c.name}</span>
          <span style={{ flex: 1 }} />
          <span style={{ color: "var(--muted)" }}>{c.studentCount} students</span>
          <code style={{ fontSize: 16, letterSpacing: ".18em", padding: "4px 12px" }}>{c.joinCode}</code>
        </div>
      ))}
      <form onSubmit={create} className="genrow" style={{ marginTop: 12, marginBottom: 0 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder='New class name, e.g. "Period 3 — Intro Java"' />
        <button className="btn green" disabled={busy}>
          + Create class
        </button>
      </form>
      {error && <div className="offline-note">✗ {error}</div>}
    </div>
  );
}
