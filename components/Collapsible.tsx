"use client";

// A foldable panel that remembers its open/closed state per key. Wrap any
// dashboard section to let people collapse it and save vertical space.
import { useEffect, useState } from "react";

export default function Collapsible({
  title,
  storageKey,
  defaultOpen = true,
  right,
  children,
}: {
  title: string;
  storageKey: string;
  defaultOpen?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    const s = localStorage.getItem("fold:" + storageKey);
    if (s !== null) setOpen(s === "1");
  }, [storageKey]);

  function toggle() {
    const n = !open;
    setOpen(n);
    try {
      localStorage.setItem("fold:" + storageKey, n ? "1" : "0");
    } catch {}
  }

  return (
    <div className="foldpanel">
      <div className="foldhead">
        <button className="foldbtn" onClick={toggle}>
          <span className={`foldcaret ${open ? "open" : ""}`}>▸</span> {title}
        </button>
        {right}
      </div>
      {open && <div className="foldbody">{children}</div>}
    </div>
  );
}
