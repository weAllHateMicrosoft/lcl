"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Publish / unpublish an assignment inline. Publishing a Google-linked class's
// test auto-creates/updates the Classroom assignment; unpublishing hides it.
export default function AssignmentControls({ id, published }: { id: string; published: boolean }) {
  const router = useRouter();
  const [pub, setPub] = useState(published);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function toggle() {
    setBusy(true);
    setNote("");
    const d = await fetch("/api/tests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish", id, published: !pub }) }).then((r) => r.json());
    setBusy(false);
    setPub(!pub);
    if (d.google) setNote(d.google.synced ? "🎓 synced" : `sync failed: ${d.google.error || ""}`);
    router.refresh();
  }

  return (
    <>
      {note && <span className="meta" style={{ margin: 0 }}>{note}</span>}
      <button className={pub ? "btn ghost" : "btn green"} onClick={toggle} disabled={busy}>
        {busy ? "…" : pub ? "Unpublish" : "Publish"}
      </button>
    </>
  );
}
