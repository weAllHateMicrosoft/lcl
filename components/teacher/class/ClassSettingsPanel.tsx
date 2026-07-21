"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

async function classAction(body: object) {
  return fetch("/api/classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
}
async function gAction(body: object) {
  return fetch("/api/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
}

export default function ClassSettingsPanel(props: {
  classId: string;
  name: string;
  joinCode: string;
  googleConnected: boolean;
  googleEmail: string | null;
  googleCourseId: string | null;
  googleCourseName: string | null;
}) {
  const router = useRouter();
  const { classId } = props;
  const [name, setName] = useState(props.name);
  const [code, setCode] = useState(props.joinCode);
  const [picker, setPicker] = useState<null | { id: string; name: string; section?: string }[]>(null);

  async function saveName() {
    if (name.trim() && name !== props.name) { await classAction({ action: "rename", classId, name }); router.refresh(); }
  }
  async function regen() {
    if (!confirm("New join code? The old one stops working.")) return;
    const d = await classAction({ action: "regenerateCode", classId });
    if (d.joinCode) setCode(d.joinCode);
  }
  async function del() {
    if (!confirm(`Delete "${props.name}" and all its students' data? This cannot be undone.`)) return;
    await classAction({ action: "delete", classId });
    router.push("/class");
  }
  async function openPicker() {
    const d = await fetch("/api/google").then((r) => r.json());
    if (d.error) return alert(`Couldn't load Google courses: ${d.error}`);
    setPicker(d.courses || []);
  }
  async function link(courseId: string, courseName: string) { await gAction({ action: "link", classId, courseId, courseName }); setPicker(null); router.refresh(); }
  async function unlink() { if (confirm("Unlink the Google course?")) { await gAction({ action: "unlink", classId }); router.refresh(); } }

  return (
    <>
      <div className="panel">
        <h2>Class</h2>
        <label className="field"><span className="l">Name</span>
          <input className="f" value={name} onChange={(e) => setName(e.target.value)} onBlur={saveName} />
        </label>
        <label className="field"><span className="l">Join code</span>
          <div className="runrow">
            <code style={{ fontSize: 18, letterSpacing: ".2em", padding: "6px 14px" }}>{code}</code>
            <button className="btn ghost" onClick={regen}>Regenerate</button>
          </div>
        </label>
      </div>

      <div className="panel">
        <h2>Google Classroom</h2>
        {!props.googleConnected ? (
          <p style={{ fontSize: 14 }}>Connect your Google account (do this once, on any class) to sync assignments, grades and announcements. <a className="btn" href="/api/auth/google" style={{ textDecoration: "none", marginLeft: 8 }}>Connect Google</a></p>
        ) : props.googleCourseId ? (
          <div className="runrow">
            <span>🎓 Linked to <b>{props.googleCourseName || "a course"}</b>. Tests, grades and announcements sync here.</span>
            <button className="tbtn2" onClick={unlink}>Unlink</button>
          </div>
        ) : picker ? (
          <div>
            <div style={{ marginBottom: 6, fontSize: 13 }}>Pick a Google course:</div>
            {picker.length === 0 && <div className="meta">No active Google courses.</div>}
            {picker.map((g) => (
              <button key={g.id} className="btn ghost" style={{ display: "block", width: "100%", textAlign: "left", marginBottom: 4 }} onClick={() => link(g.id, g.name)}>{g.name}{g.section ? ` · ${g.section}` : ""}</button>
            ))}
            <button className="tbtn2" onClick={() => setPicker(null)}>Cancel</button>
          </div>
        ) : (
          <div className="runrow"><span style={{ color: "var(--muted)" }}>Connected as {props.googleEmail}. Not linked to a course.</span><button className="tbtn2" onClick={openPicker}>Link a Google course</button></div>
        )}
      </div>

      <div className="panel" style={{ borderColor: "var(--accent-2)" }}>
        <h2>Danger zone</h2>
        <button className="btn orange" onClick={del}>Delete this class</button>
      </div>
    </>
  );
}
