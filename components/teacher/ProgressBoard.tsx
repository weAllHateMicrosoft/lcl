"use client";

import { useState } from "react";
import Link from "next/link";
import type { InsightPayload } from "@/lib/oversee";

export type StudentCard = {
  id: string;
  name: string;
  lastActive: string | null;
  units: { title: string; lessons: { code: string; title: string; skills: { statement: string; state: string; estimate: number; n: number }[] }[] }[];
  rollup: { strong: number; weak: number; unknown: number; total: number };
  activity: { at: string; line: string }[];
  insight: { payload: InsightPayload; createdAt: string; stale: boolean } | null;
};

const ALERT: Record<string, { label: string; color: string }> = {
  ok: { label: "ON TRACK", color: "var(--accent)" },
  watch: { label: "WATCH", color: "#c98a00" },
  help: { label: "NEEDS HELP", color: "#b3352e" },
};
const TREND: Record<string, string> = { improving: "↗ improving", steady: "→ steady", slipping: "↘ slipping", inactive: "· inactive" };
const STATE_COLOR: Record<string, string> = { strong: "var(--accent)", weak: "#c98a00", unknown: "var(--muted)" };

export default function ProgressBoard({ classId, students }: { classId: string; students: StudentCard[] }) {
  const [cards, setCards] = useState(students);
  const [busy, setBusy] = useState<string | null>(null);
  const [busyAll, setBusyAll] = useState(false);

  async function refresh(id: string) {
    setBusy(id);
    const d = await fetch("/api/oversee", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId: id }) }).then((r) => r.json());
    if (d.insight) {
      setCards((cs) => cs.map((c) => (c.id === id ? { ...c, insight: { payload: d.insight, createdAt: d.createdAt, stale: false } } : c)));
    } else if (d.error) {
      alert(d.error);
    }
    setBusy(null);
  }

  async function refreshAll() {
    setBusyAll(true);
    for (const c of cards) {
      if (!c.insight || c.insight.stale) await refresh(c.id); // only the ones that need it
    }
    setBusyAll(false);
  }

  const needing = cards.filter((c) => !c.insight || c.insight.stale).length;

  return (
    <div>
      <div className="edbar" style={{ marginBottom: 12 }}>
        <span className="meta" style={{ margin: 0 }}>
          {needing === 0 ? "All briefs are current." : `${needing} student${needing === 1 ? "" : "s"} with new activity since their last brief.`}
        </span>
        <span style={{ flex: 1 }} />
        <button className="btn purple" disabled={busyAll || needing === 0} onClick={refreshAll}>
          {busyAll ? "✦ reading records…" : `✦ Update ${needing || ""} brief${needing === 1 ? "" : "s"}`}
        </button>
      </div>
      {cards.map((c) => (
        <Card key={c.id} c={c} busy={busy === c.id} onRefresh={() => refresh(c.id)} />
      ))}
    </div>
  );
}

function Card({ c, busy, onRefresh }: { c: StudentCard; busy: boolean; onRefresh: () => void }) {
  const [showActivity, setShowActivity] = useState(false);
  const [showSkills, setShowSkills] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const p = c.insight?.payload;
  const alert = p ? ALERT[p.alert] || ALERT.ok : null;
  const daysIdle = c.lastActive ? Math.floor((Date.now() - new Date(c.lastActive).getTime()) / 86400000) : null;

  return (
    <div className="panel" style={{ padding: "14px 18px", borderLeft: alert ? `4px solid ${alert.color}` : undefined }}>
      {/* header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <Link href={`/teacher/student/${c.id}`} style={{ fontFamily: "var(--serif)", fontSize: 17, fontWeight: 700, textDecoration: "underline dotted var(--muted)" }}>
          {c.name}
        </Link>
        {alert && <span className="statuschip" style={{ borderColor: alert.color, color: alert.color }}>{alert.label}</span>}
        {p && <span className="meta" style={{ margin: 0 }}>{TREND[p.trend]}</span>}
        <span style={{ flex: 1 }} />
        <span className="meta" style={{ margin: 0 }}>
          {daysIdle === null ? "no activity yet" : daysIdle === 0 ? "active today" : `last active ${daysIdle}d ago`}
        </span>
        <MiniBar r={c.rollup} />
      </div>

      {/* AI brief */}
      {p ? (
        <div style={{ marginTop: 8 }}>
          <p style={{ margin: "4px 0", fontSize: 14.5 }}>{p.summary}</p>
          {p.gaps.length > 0 && (
            <div style={{ margin: "6px 0" }}>
              {p.gaps.map((g, i) => (
                <div key={i} style={{ fontSize: 13, color: "#8a5a00", margin: "2px 0" }}>
                  ▸ <b>{g.skill}</b> <span style={{ color: "var(--muted)" }}>({g.unit})</span> — {g.evidence}
                </div>
              ))}
            </div>
          )}
          {p.actions.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0 2px" }}>
              {p.actions.map((a, i) => (
                <span key={i} className="cellpill" title={a.detail} style={{ cursor: "help" }}>💡 {a.label}</span>
              ))}
            </div>
          )}
          <div className="meta" style={{ marginTop: 6 }}>
            brief from {new Date(c.insight!.createdAt).toLocaleString()} {c.insight!.stale && <b style={{ color: "#c98a00" }}>· new activity since — refresh</b>}
          </div>
        </div>
      ) : (
        <p className="meta" style={{ marginTop: 8 }}>No AI brief yet for {c.name}.</p>
      )}

      {/* controls */}
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button className="btn purple" style={{ padding: "5px 12px" }} disabled={busy} onClick={onRefresh}>
          {busy ? "✦ reading…" : p ? "✦ Refresh brief" : "✦ Write brief"}
        </button>
        {p?.studentMessage && (
          <button className="btn ghost" style={{ padding: "5px 12px" }} onClick={() => setMsgOpen(!msgOpen)}>
            ✉ Send note to {c.name.split(" ")[0]}
          </button>
        )}
        <button className="btn ghost" style={{ padding: "5px 12px" }} onClick={() => setShowSkills(!showSkills)}>
          {showSkills ? "Hide" : "Show"} skills by unit
        </button>
        <button className="btn ghost" style={{ padding: "5px 12px" }} onClick={() => setShowActivity(!showActivity)}>
          {showActivity ? "Hide" : "Show"} activity
        </button>
      </div>

      {msgOpen && p?.studentMessage && <SendNote toId={c.id} initial={p.studentMessage} onDone={() => setMsgOpen(false)} />}

      {/* unit-by-unit skills */}
      {showSkills && (
        <div style={{ marginTop: 10 }}>
          {c.units.length === 0 && <p className="meta">No skills mapped yet — build the skill map first.</p>}
          {c.units.map((u) => (
            <div key={u.title} style={{ margin: "8px 0" }}>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--muted)", fontWeight: 700 }}>{u.title}</div>
              {u.lessons.map((l) => (
                <div key={l.code} style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap", margin: "4px 0 4px 8px" }}>
                  <Link href={`/lessons/${l.code}`} className="meta" style={{ minWidth: 150, margin: 0, textDecoration: "underline dotted" }}>
                    {l.code} {l.title}
                  </Link>
                  <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {l.skills.map((s, i) => (
                      <span
                        key={i}
                        title={s.state === "unknown" ? `${s.n} answer(s) — not enough to judge` : `${s.state} · est ${Math.round(s.estimate * 100)}% · ${s.n} answers`}
                        style={{ fontSize: 12, padding: "1px 8px", borderRadius: 10, border: `1px solid ${STATE_COLOR[s.state]}`, color: STATE_COLOR[s.state] }}
                      >
                        {s.state === "strong" ? "●" : s.state === "weak" ? "◐" : "○"} {s.statement}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* activity feed */}
      {showActivity && (
        <div style={{ marginTop: 10 }}>
          {c.activity.length === 0 && <p className="meta">Nothing yet.</p>}
          {c.activity.map((a, i) => (
            <div key={i} className="meta" style={{ margin: "3px 0" }}>
              {timeAgo(a.at)} — {a.line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SendNote({ toId, initial, onDone }: { toId: string; initial: string; onDone: () => void }) {
  const [body, setBody] = useState(initial);
  const [status, setStatus] = useState("");
  async function send() {
    setStatus("sending…");
    const d = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toId, body }) }).then((r) => r.json());
    setStatus(d.error ? d.error : "sent ✓");
    if (!d.error) setTimeout(onDone, 900);
  }
  return (
    <div style={{ marginTop: 8 }}>
      <textarea className="f" rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="runrow" style={{ marginTop: 6 }}>
        <button className="btn green" onClick={send}>Send</button>
        <button className="btn ghost" onClick={onDone}>Cancel</button>
        {status && <span className="meta" style={{ margin: 0 }}>{status}</span>}
      </div>
      <p className="meta" style={{ marginTop: 4 }}>AI-drafted — edit freely before sending. It goes from you, not the AI.</p>
    </div>
  );
}

function MiniBar({ r }: { r: { strong: number; weak: number; unknown: number; total: number } }) {
  if (r.total === 0) return null;
  const seg = (n: number, color: string) => (n > 0 ? <span style={{ flex: n, background: color, height: 8, borderRadius: 2 }} /> : null);
  return (
    <span style={{ display: "flex", gap: 2, width: 140, alignItems: "center" }} title={`${r.strong} strong · ${r.weak} weak · ${r.unknown} unknown`}>
      {seg(r.weak, "#c98a00")}
      {seg(r.strong, "var(--accent)")}
      {seg(r.unknown, "var(--line, #ddd)")}
      <span className="meta" style={{ marginLeft: 6, whiteSpace: "nowrap" }}>{r.strong}/{r.total}</span>
    </span>
  );
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
