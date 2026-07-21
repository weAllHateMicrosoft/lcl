"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { seg: "", label: "Overview" },
  { seg: "students", label: "Students" },
  { seg: "assignments", label: "Assignments" },
  { seg: "gradebook", label: "Gradebook" },
  { seg: "mastery", label: "Progress" },
  { seg: "stream", label: "Stream" },
  { seg: "settings", label: "Settings" },
];

export default function ClassTabs({ id }: { id: string }) {
  const path = usePathname();
  const base = `/class/${id}`;
  return (
    <div className="classtabs">
      {TABS.map((t) => {
        const href = t.seg ? `${base}/${t.seg}` : base;
        const active = t.seg ? path.startsWith(href) : path === base;
        return (
          <Link key={t.seg} href={href} className={active ? "on" : ""}>
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
