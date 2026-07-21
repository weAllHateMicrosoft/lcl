"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type S = { id: string; name: string; email: string | null; active: boolean };

async function classAction(body: object) {
  return fetch("/api/classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
}
async function gAction(body: object) {
  return fetch("/api/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
}

export default function RosterPanel({
  classId,
  joinCode,
  googleLinked,
  googleConnected,
  students,
}: {
  classId: string;
  joinCode: string;
  googleLinked: boolean;
  googleConnected: boolean;
  students: S[];
}) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function importRoster() {
    if (!confirm("Import all students from the linked Google class?")) return;
    setBusy(true);
    const d = await gAction({ action: "importRoster", classId });
    setBusy(false);
    if (d.error) return alert(`Import failed: ${d.error}`);
    alert(`Imported ✓ — ${d.created} new, ${d.linked} linked${d.skipped ? `, ${d.skipped} skipped` : ""}.`);
    router.refresh();
  }
  async function rename(s: S) {
    const nn = prompt(`Rename ${s.name} to:`, s.name);
    if (nn?.trim() && nn !== s.name) { await classAction({ action: "renameStudent", studentId: s.id, name: nn }); router.refresh(); }
  }
  async function remove(s: S) {
    if (!confirm(`Remove ${s.name}? Their progress is deleted.`)) return;
    await classAction({ action: "removeStudent", studentId: s.id });
    router.refresh();
  }

  return (
    <>
      <div className="panel">
        <h2>How students join</h2>
        <p style={{ fontSize: 14 }}>
          Students go to <code>/join</code> and enter the class code{" "}
          <code style={{ fontSize: 16, letterSpacing: ".16em", cursor: "pointer" }} onClick={() => { navigator.clipboard?.writeText(joinCode); setCopied(true); setTimeout(() => setCopied(false), 1200); }}>
            {copied ? "copied!" : joinCode}
          </code>
          , their name, email and a password.
        </p>
        {googleConnected && googleLinked && (
          <button className="btn" onClick={importRoster} disabled={busy}>{busy ? "importing…" : "🎓 Import from Google Classroom"}</button>
        )}
        {googleConnected && !googleLinked && <p className="meta">Link a Google course in <b>Settings</b> to import its roster.</p>}
      </div>

      <div className="panel">
        <h2>Roster <span className="tag k">{students.length}</span></h2>
        {students.length === 0 && <p style={{ color: "var(--muted)", fontSize: 14 }}>No students yet.</p>}
        {students.map((s) => (
          <div className="rstudent" key={s.id}>
            <Link href={`/teacher/student/${s.id}`} style={{ fontWeight: 600, textDecoration: "underline dotted var(--muted)" }}>{s.name}</Link>
            {!s.active && <span className="statuschip draft" title="Imported — activates when they sign up with this email">pending</span>}
            <span style={{ color: "var(--muted)", fontSize: 12 }}>{s.email}</span>
            <span style={{ flex: 1 }} />
            <Link href="/inbox" className="tbtn2" title="Message">✉</Link>
            <button className="tbtn2" onClick={() => rename(s)} title="Rename">✎</button>
            <button className="tbtn2 danger" onClick={() => remove(s)} title="Remove">✕</button>
          </div>
        ))}
      </div>
    </>
  );
}
