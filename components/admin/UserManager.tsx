"use client";

import { useEffect, useState } from "react";

type U = { id: string; name: string; email: string | null; role: string; className: string | null; verified: boolean; locked: boolean; totp: boolean };

async function act(body: object) {
  const r = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: r.ok, ...(await r.json()) };
}

export default function UserManager({ meId }: { meId: string }) {
  const [users, setUsers] = useState<U[]>([]);
  const [filter, setFilter] = useState("");
  const [edit, setEdit] = useState<{ id: string; field: "name" | "email" | "password"; value: string } | null>(null);
  const [confirm, setConfirm] = useState<U | null>(null);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "" });

  async function load() {
    const d = await fetch("/api/admin/users").then((r) => r.json());
    setUsers(d.users || []);
  }
  useEffect(() => {
    load();
  }, []);

  async function run(body: object, okMsg: string) {
    const d = await act(body);
    setMsg(d.ok ? okMsg : d.error || "failed");
    if (d.ok) load();
  }

  async function saveEdit() {
    if (!edit) return;
    const { id, field, value } = edit;
    setEdit(null);
    if (!value.trim()) return;
    if (field === "name") run({ action: "rename", id, name: value }, "renamed ✓");
    if (field === "email") run({ action: "setEmail", id, email: value }, "email changed ✓ (marked verified)");
    if (field === "password") run({ action: "setPassword", id, password: value }, "password set ✓ (account unlocked)");
  }

  async function addTeacher(e: React.FormEvent) {
    e.preventDefault();
    const d = await act({ action: "addTeacher", ...form });
    setMsg(d.ok ? "teacher added ✓" : d.error || "failed");
    if (d.ok) {
      setForm({ name: "", email: "", password: "" });
      load();
    }
  }

  const shown = users.filter((u) => (u.name + " " + (u.email || "") + " " + u.role).toLowerCase().includes(filter.toLowerCase()));

  return (
    <>
      <div className="runrow" style={{ marginBottom: 10 }}>
        <input className="f" style={{ maxWidth: 300 }} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search name / email / role…" />
        {msg && <span className="meta" style={{ margin: 0 }}>{msg}</span>}
      </div>

      {edit && (
        <div className="notice" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <b>{edit.field === "password" ? "New password" : `New ${edit.field}`}:</b>
          <input
            className="f"
            style={{ maxWidth: 280 }}
            type={edit.field === "password" ? "text" : "text"}
            value={edit.value}
            autoFocus
            onChange={(e) => setEdit({ ...edit, value: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && saveEdit()}
          />
          <button className="btn green" style={{ padding: "6px 12px" }} onClick={saveEdit}>Save</button>
          <button className="tbtn2" onClick={() => setEdit(null)}>Cancel</button>
        </div>
      )}

      {confirm && (
        <div className="confirmbar" style={{ borderRadius: 8, marginBottom: 10 }}>
          Remove <b>{confirm.name}</b> ({confirm.role.toLowerCase()}) and all their data?
          <button className="btn orange" style={{ padding: "5px 12px", fontSize: 12 }} onClick={() => { run({ action: "remove", id: confirm.id }, "removed ✓"); setConfirm(null); }}>Remove</button>
          <button className="tbtn2" onClick={() => setConfirm(null)}>Cancel</button>
        </div>
      )}

      <div className="dashgrid">
        <table>
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Class</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {shown.map((u) => (
              <tr key={u.id}>
                <td className="name">{u.name}{u.id === meId && " (you)"}</td>
                <td style={{ color: "var(--muted)", fontSize: 13 }}>{u.email || "—"}</td>
                <td><span className="statuschip live">{u.role}</span></td>
                <td style={{ fontSize: 13 }}>{u.className || "—"}</td>
                <td style={{ fontSize: 11, fontFamily: "var(--mono)" }}>
                  {u.locked ? <span className="score bad">LOCKED</span> : u.verified ? <span className="score ok">verified</span> : <span style={{ color: "var(--muted)" }}>unverified</span>}
                  {u.totp && " · 2FA"}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <button className="tbtn2" title="Rename" onClick={() => setEdit({ id: u.id, field: "name", value: u.name })}>✎</button>
                  <button className="tbtn2" title="Change email" onClick={() => setEdit({ id: u.id, field: "email", value: u.email || "" })}>@</button>
                  <button className="tbtn2" title="Set new password" onClick={() => setEdit({ id: u.id, field: "password", value: "" })}>🔑</button>
                  {u.locked && <button className="tbtn2" title="Unlock" onClick={() => run({ action: "unlock", id: u.id }, "unlocked ✓")}>🔓</button>}
                  {!u.verified && <button className="tbtn2" title="Mark verified" onClick={() => run({ action: "verify", id: u.id }, "verified ✓")}>✓</button>}
                  {u.totp && <button className="tbtn2" title="Disable 2FA" onClick={() => run({ action: "disableTotp", id: u.id }, "2FA disabled ✓")}>⊘</button>}
                  {u.id !== meId && <button className="tbtn2 danger" title="Remove" onClick={() => setConfirm(u)}>🗑</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel" style={{ marginTop: 18 }}>
        <h2>Add a teacher</h2>
        <form onSubmit={addTeacher} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "end" }}>
          <label className="field" style={{ margin: 0 }}><span className="l">Name</span><input className="f" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
          <label className="field" style={{ margin: 0 }}><span className="l">Email</span><input className="f" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
          <label className="field" style={{ margin: 0 }}><span className="l">Temp password (8+)</span><input className="f" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>
          <button className="btn green">+ Add</button>
        </form>
      </div>
    </>
  );
}
