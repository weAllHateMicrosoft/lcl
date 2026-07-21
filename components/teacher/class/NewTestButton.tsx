"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewTestButton({ classId }: { classId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    const d = await fetch("/api/tests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", title: "Untitled test", classId }) }).then((r) => r.json());
    if (d.id) router.push(`/tests/${d.id}/edit`);
    else setBusy(false);
  }
  return <button className="btn green" onClick={create} disabled={busy}>{busy ? "creating…" : "+ New test"}</button>;
}
