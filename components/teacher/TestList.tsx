"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type T = { id: string; title: string; className: string | null; published: boolean; count: number; points: number; submissions: number };

export default function TestList() {
  const router = useRouter();
  const [tests, setTests] = useState<T[]>([]);
  const [title, setTitle] = useState("");

  async function load() {
    const d = await fetch("/api/tests").then((r) => r.json());
    setTests(d.tests || []);
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const r = await fetch("/api/tests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", title }) });
    const d = await r.json();
    if (d.id) router.push(`/tests/${d.id}/edit`);
  }

  async function del(id: string) {
    if (!confirm("Delete this test and all its submissions?")) return;
    await fetch("/api/tests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", id }) });
    load();
  }

  return (
    <>
      <form onSubmit={create} className="genrow" style={{ marginBottom: 20 }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder='New test, e.g. "Unit 2 Quiz"' />
        <button className="btn green">+ Create test</button>
      </form>

      {tests.length === 0 && <p style={{ color: "var(--muted)" }}>No tests yet.</p>}
      {tests.map((t) => (
        <div className="panel" key={t.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px" }}>
          <div>
            <b style={{ fontFamily: "var(--serif)", fontSize: 17 }}>{t.title}</b>{" "}
            <span className={`statuschip ${t.published ? "live" : "draft"}`}>{t.published ? "PUBLISHED" : "DRAFT"}</span>
            <div className="meta" style={{ margin: 0 }}>
              {t.count} questions · {t.points} pts · {t.className || "no class"} · {t.submissions} submitted
            </div>
          </div>
          <span style={{ flex: 1 }} />
          <Link className="btn ghost" href={`/tests/${t.id}/edit`}>Edit</Link>
          <Link className="btn" href={`/teacher/test/${t.id}`}>Results ({t.submissions})</Link>
          <button className="tbtn2 danger" onClick={() => del(t.id)}>🗑</button>
        </div>
      ))}
    </>
  );
}
