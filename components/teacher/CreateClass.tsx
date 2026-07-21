"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateClass() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    const d = await fetch("/api/classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", name }) }).then((r) => r.json());
    setBusy(false);
    if (d.class?.id) router.push(`/class/${d.class.id}`);
    else router.refresh();
  }

  return (
    <form onSubmit={create} className="genrow">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder='New class, e.g. "Period 3 — Intro Java"' />
      <button className="btn green" disabled={busy}>+ Create class</button>
    </form>
  );
}
