"use client";

// Teacher's class controls: create classes, rename, regenerate/copy join code,
// delete, and manage the roster (rename, remove, message, open a student's
// full record). All actions POST to /api/classes (ownership enforced server-side).

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Student = { id: string; name: string };
type ClassInfo = { id: string; name: string; joinCode: string; students: Student[] };

async function action(body: object) {
  return fetch("/api/classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
}

export default function ClassManager({ classes }: { classes: ClassInfo[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    await action({ action: "create", name: newName });
    setNewName("");
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="panel" style={{ marginBottom: 22 }}>
      <h2>
        Your classes <span className="tag k">MANAGE</span>
      </h2>

      {classes.map((c) => (
        <ClassCard key={c.id} c={c} onChange={() => router.refresh()} />
      ))}

      <form onSubmit={create} className="genrow" style={{ marginTop: 14, marginBottom: 0 }}>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder='New class, e.g. "Period 3 — Intro Java"' />
        <button className="btn green" disabled={busy}>+ Create class</button>
      </form>
    </div>
  );
}

function ClassCard({ c, onChange }: { c: ClassInfo; onChange: () => void }) {
  const [code, setCode] = useState(c.joinCode);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(c.name);
  const [copied, setCopied] = useState(false);

  async function regen() {
    if (!confirm("New code? The old one stops working (students already joined stay in).")) return;
    const r = await action({ action: "regenerateCode", classId: c.id });
    if (r.joinCode) setCode(r.joinCode);
  }
  async function del() {
    if (!confirm(`Delete "${c.name}" and all ${c.students.length} students' data? This cannot be undone.`)) return;
    await action({ action: "delete", classId: c.id });
    onChange();
  }
  async function saveName() {
    setRenaming(false);
    if (name !== c.name) {
      await action({ action: "rename", classId: c.id, name });
      onChange();
    }
  }
  async function kick(s: Student) {
    if (!confirm(`Remove ${s.name} from the class? Their progress is deleted.`)) return;
    await action({ action: "removeStudent", studentId: s.id });
    onChange();
  }
  async function rename(s: Student) {
    const nn = prompt(`Rename ${s.name} to:`, s.name);
    if (nn && nn.trim() && nn !== s.name) {
      await action({ action: "renameStudent", studentId: s.id, name: nn });
      onChange();
    }
  }

  return (
    <div className="classcard">
      <div className="cchead">
        {renaming ? (
          <input className="f" style={{ maxWidth: 260 }} value={name} autoFocus onChange={(e) => setName(e.target.value)} onBlur={saveName} onKeyDown={(e) => e.key === "Enter" && saveName()} />
        ) : (
          <b style={{ fontFamily: "var(--serif)", fontSize: 16 }} onClick={() => setRenaming(true)} title="Click to rename" role="button">
            {c.name}
          </b>
        )}
        <span style={{ flex: 1 }} />
        <span style={{ color: "var(--muted)", fontSize: 12 }}>{c.students.length} students</span>
        <code
          style={{ fontSize: 15, letterSpacing: ".16em", padding: "4px 12px", cursor: "pointer" }}
          title="Click to copy"
          onClick={() => {
            navigator.clipboard?.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? "copied!" : code}
        </code>
        <button className="tbtn2" onClick={regen} title="New join code">↻</button>
        <button className="tbtn2 danger" onClick={del} title="Delete class">🗑</button>
      </div>

      {c.students.length > 0 && (
        <div className="roster">
          {c.students.map((s) => (
            <div className="rstudent" key={s.id}>
              <Link href={`/teacher/student/${s.id}`} style={{ fontWeight: 600, textDecoration: "underline dotted var(--muted)" }}>
                {s.name}
              </Link>
              <span style={{ flex: 1 }} />
              <Link href={`/inbox`} className="tbtn2" title="Message (opens inbox)">✉</Link>
              <button className="tbtn2" onClick={() => rename(s)} title="Rename">✎</button>
              <button className="tbtn2 danger" onClick={() => kick(s)} title="Remove from class">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
