"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type MiniUser = { id: string; name: string; role: string };

export default function Nav({ me, users }: { me: MiniUser; users: MiniUser[] }) {
  const path = usePathname();
  const router = useRouter();
  const is = (p: string) => (path === p || path.startsWith(p + "/") ? "active" : "");

  async function switchUser(id: string) {
    await fetch("/api/user", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: id }) });
    router.refresh();
  }

  return (
    <nav className="nav">
      <Link href="/" className="brand">
        class<span>OS</span>
      </Link>
      <Link href="/lessons" className={is("/lessons")}>
        Lessons
      </Link>
      {(me.role === "TEACHER" || me.role === "ADMIN") && (
        <Link href="/teacher" className={is("/teacher")}>
          Teacher
        </Link>
      )}
      {me.role === "ADMIN" && (
        <>
          <Link href="/admin/editor" className={is("/admin/editor")}>
            Editor
          </Link>
          <Link href="/admin/settings" className={is("/admin/settings")}>
            Settings
          </Link>
        </>
      )}
      <div className="spacer" />
      <div className="rolebar">
        <span>acting as</span>
        <select value={me.id} onChange={(e) => switchUser(e.target.value)} title="Dev role switcher (replaced by Auth.js later)">
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} · {u.role}
            </option>
          ))}
        </select>
      </div>
    </nav>
  );
}
