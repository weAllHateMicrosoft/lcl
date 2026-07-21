"use client";

// Teacher's class controls: create classes, rename, regenerate/copy join code,
// delete, and manage the roster (rename, remove, message, open a student's
// full record). All actions POST to /api/classes (ownership enforced server-side).

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type Student = { id: string; name: string };
type ClassInfo = { id: string; name: string; joinCode: string; students: Student[]; googleCourseId?: string | null; googleCourseName?: string | null };
type Google = { connected: boolean; email?: string | null };

async function action(body: object) {
  return fetch("/api/classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
}
async function gAction(body: object) {
  return fetch("/api/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
}

const G_MSG: Record<string, string> = {
  connected: "✓ Google Classroom connected.",
  denied: "You declined the Google permissions.",
  norefresh: "Google didn't return a refresh token — disconnect classOS in your Google account, then reconnect.",
  badstate: "Connection expired — try again.",
  exchange: "Google rejected the sign-in — try again.",
  error: "Something went wrong connecting to Google.",
};

export default function ClassManager({ classes, google }: { classes: ClassInfo[]; google: Google }) {
  const router = useRouter();
  const params = useSearchParams();
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    const g = params.get("google");
    if (g && G_MSG[g]) {
      setNote(G_MSG[g]);
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      {/* Google Classroom connection */}
      <div className="gbanner">
        <span>🎓 Google Classroom:</span>
        {google.connected ? (
          <>
            <b>connected{google.email ? ` as ${google.email}` : ""}</b>
            <span style={{ flex: 1 }} />
            <button className="tbtn2" onClick={async () => { if (confirm("Disconnect Google Classroom? Assignment sync stops.")) { await gAction({ action: "disconnect" }); router.refresh(); } }}>Disconnect</button>
          </>
        ) : (
          <>
            <span style={{ color: "var(--muted)" }}>not connected — link it to sync tests as assignments</span>
            <span style={{ flex: 1 }} />
            <a className="btn" href="/api/auth/google" style={{ textDecoration: "none", padding: "6px 14px" }}>Connect</a>
          </>
        )}
      </div>
      {note && <div className="notice">{note}</div>}

      {classes.map((c) => (
        <ClassCard key={c.id} c={c} googleConnected={google.connected} onChange={() => router.refresh()} />
      ))}

      <form onSubmit={create} className="genrow" style={{ marginTop: 14, marginBottom: 0 }}>
        <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder='New class, e.g. "Period 3 — Intro Java"' />
        <button className="btn green" disabled={busy}>+ Create class</button>
      </form>
    </div>
  );
}

function ClassCard({ c, googleConnected, onChange }: { c: ClassInfo; googleConnected: boolean; onChange: () => void }) {
  const [code, setCode] = useState(c.joinCode);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(c.name);
  const [copied, setCopied] = useState(false);
  const [picker, setPicker] = useState<null | { id: string; name: string; section?: string }[]>(null);
  const [gLoading, setGLoading] = useState(false);
  const [announce, setAnnounce] = useState<string | null>(null);

  async function importRoster() {
    if (!confirm("Import all students from the linked Google class? New ones get pending accounts they activate by signing up with their email.")) return;
    setGLoading(true);
    const d = await gAction({ action: "importRoster", classId: c.id });
    setGLoading(false);
    if (d.error) return alert(`Import failed: ${d.error}`);
    alert(`Imported ✓ — ${d.created} new, ${d.linked} linked${d.skipped ? `, ${d.skipped} skipped (no email/staff)` : ""}.`);
    onChange();
  }
  async function sendAnnounce() {
    const text = (announce || "").trim();
    if (!text) return;
    const d = await gAction({ action: "announce", classId: c.id, text });
    setAnnounce(null);
    if (d.error) return alert(d.error);
    const g = d.google ? (d.google.posted ? " + Google Classroom stream" : ` (Google failed: ${d.google.error})`) : "";
    alert(`Posted to ${d.sent} students' inbox${g}.`);
    onChange();
  }

  async function openPicker() {
    setGLoading(true);
    const d = await fetch("/api/google").then((r) => r.json());
    setGLoading(false);
    if (d.error) return alert(`Couldn't load Google courses: ${d.error}`);
    setPicker(d.courses || []);
  }
  async function link(courseId: string, courseName: string) {
    await gAction({ action: "link", classId: c.id, courseId, courseName });
    setPicker(null);
    onChange();
  }
  async function unlink() {
    if (!confirm(`Unlink "${c.googleCourseName}" from this class?`)) return;
    await gAction({ action: "unlink", classId: c.id });
    onChange();
  }

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
        <button className="tbtn2" onClick={() => setAnnounce(announce === null ? "" : null)} title="Post an announcement">📣</button>
        <button className="tbtn2" onClick={regen} title="New join code">↻</button>
        <button className="tbtn2 danger" onClick={del} title="Delete class">🗑</button>
      </div>

      {announce !== null && (
        <div className="glink" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <textarea className="f" rows={2} value={announce} autoFocus placeholder="Announcement — goes to every student's inbox, and to the Google Classroom stream if linked…" onChange={(e) => setAnnounce(e.target.value)} />
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            <button className="btn green" style={{ padding: "6px 12px" }} onClick={sendAnnounce} disabled={!announce.trim()}>Post</button>
            <button className="tbtn2" onClick={() => setAnnounce(null)}>Cancel</button>
          </div>
        </div>
      )}

      {googleConnected && (
        <div className="glink">
          {c.googleCourseId ? (
            <>
              <span>🎓 Linked to <b>{c.googleCourseName || "a Google course"}</b> — tests sync as assignments; grades push back.</span>
              <span style={{ flex: 1 }} />
              <button className="tbtn2" onClick={importRoster} disabled={gLoading} title="Pull the Google roster into this class">{gLoading ? "…" : "Import students"}</button>
              <button className="tbtn2" onClick={unlink}>Unlink</button>
            </>
          ) : picker ? (
            <div style={{ width: "100%" }}>
              <div style={{ marginBottom: 6, fontSize: 13 }}>Pick a Google course to link:</div>
              {picker.length === 0 && <div className="meta">No active Google courses found.</div>}
              {picker.map((g) => (
                <button key={g.id} className="btn ghost" style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 4 }} onClick={() => link(g.id, g.name)}>
                  {g.name}{g.section ? ` · ${g.section}` : ""}
                </button>
              ))}
              <button className="tbtn2" onClick={() => setPicker(null)}>Cancel</button>
            </div>
          ) : (
            <>
              <span style={{ color: "var(--muted)" }}>Not linked to a Google course.</span>
              <span style={{ flex: 1 }} />
              <button className="tbtn2" onClick={openPicker} disabled={gLoading}>{gLoading ? "loading…" : "Link Google course"}</button>
            </>
          )}
        </div>
      )}

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
