"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Staff = { id: string; name: string; email: string | null; role: string };

export default function StaffManager({ staff, meId }: { staff: Staff[]; meId: string }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [msg, setMsg] = useState("");

  async function act(body: object) {
    const r = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) setMsg(d.error || "failed");
    return d;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const d = await act({ action: "addTeacher", ...form });
    if (d.ok) {
      setForm({ name: "", email: "", password: "" });
      setMsg("teacher added ✓");
      router.refresh();
    }
  }

  return (
    <div className="panel">
      <h2>Staff accounts <span className="tag k">ADMIN</span></h2>
      <div className="dashgrid" style={{ marginBottom: 16 }}>
        <table>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id}>
                <td className="name">{s.name}{s.id === meId && " (you)"}</td>
                <td style={{ color: "var(--muted)" }}>{s.email}</td>
                <td><span className="statuschip live">{s.role}</span></td>
                <td>
                  <button className="tbtn2" title="Reset password" onClick={async () => { const d = await act({ action: "resetPassword", id: s.id }); if (d.password) alert(`New temporary password for ${s.name}:\n\n${d.password}\n\nGive it to them; they can change it at /account.`); }}>🔑</button>
                  {s.id !== meId && <button className="tbtn2 danger" title="Remove" onClick={async () => { if (confirm(`Remove ${s.name}? Their classes stay but lose their teacher link.`)) { await act({ action: "remove", id: s.id }); router.refresh(); } }}>🗑</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={add} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
        <label className="field" style={{ margin: 0 }}><span className="l">Name</span><input className="f" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
        <label className="field" style={{ margin: 0 }}><span className="l">Email</span><input className="f" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        <label className="field" style={{ margin: 0 }}><span className="l">Temp password (8+)</span><input className="f" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
        <button className="btn green">+ Add teacher</button>
      </form>
      {msg && <div className="meta">{msg}</div>}
    </div>
  );
}
