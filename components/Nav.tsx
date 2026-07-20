"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

type MiniUser = { id: string; name: string; role: string; className?: string | null; avatar?: string | null };

export default function Nav({ me, cost, unread = 0 }: { me: MiniUser | null; cost: { total: number; calls: number } | null; unread?: number }) {
  const path = usePathname();
  const router = useRouter();
  const on = (p: string) => (path === p || path.startsWith(p + "/") ? "on" : "");

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="topbar">
      <Link href="/" className="logo">
        class<em>OS</em>
      </Link>
      <div className="proto">SELF-HOSTED</div>
      <div className="spacer" />
      {me ? (
        <>
          {cost && (
            <div className="costbadge">
              AI cost: ${cost.total.toFixed(5)} · {cost.calls} calls
            </div>
          )}
          <div className="modelbox" title={me.className ? `Class: ${me.className}` : undefined}>
            <span className="avatar-sm">{me.avatar ? <img src={me.avatar} alt="" /> : me.name.slice(0, 1).toUpperCase()}</span>
            <span style={{ color: "#e9e4d8", fontFamily: "var(--sans)", fontWeight: 600, fontSize: 13 }}>{me.name}</span>
          </div>
          <nav className="viewswitch">
            <Link href="/lessons" className={on("/lessons")}>
              {me.role === "STUDENT" ? "My lessons" : "Student view"}
            </Link>
            <Link href="/tests" className={on("/tests")}>
              Tests
            </Link>
            <Link href="/gradebook" className={on("/gradebook")}>
              Grades
            </Link>
            {(me.role === "TEACHER" || me.role === "ADMIN") && (
              <Link href="/teacher" className={on("/teacher")}>
                Teacher
              </Link>
            )}
            {me.role === "ADMIN" && (
              <>
                <Link href="/admin/editor" className={on("/admin/editor")}>
                  Editor
                </Link>
                <Link href="/admin/settings" className={on("/admin/settings")}>
                  Settings
                </Link>
              </>
            )}
          </nav>
          <Link href="/inbox" className={`tbtn inbox-link ${on("/inbox")}`} style={{ textDecoration: "none", position: "relative" }}>
            ✉ Messages
            {unread > 0 && <span className="navbadge">{unread}</span>}
          </Link>
          {me.role !== "STUDENT" && (
            <Link href="/account" className="tbtn" style={{ textDecoration: "none" }}>
              Account
            </Link>
          )}
          <ThemeToggle />
          <button className="tbtn" onClick={logout}>
            Sign out
          </button>
        </>
      ) : (
        <nav className="viewswitch">
          <ThemeToggle />
          <Link href="/join" className={on("/join")}>
            Join class
          </Link>
          <Link href="/login" className={on("/login")}>
            Staff sign-in
          </Link>
        </nav>
      )}
    </div>
  );
}
