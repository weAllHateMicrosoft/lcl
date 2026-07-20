"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Item = { type: string; q: string; yourAnswer: string; correctAnswer: string; awarded: number; max: number; note: string; pending: boolean };
type Data = { title: string; awarded: number; gradedMax: number; pendingMax: number; items: Item[] };

export default function TestResult({ id }: { id: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/tests/${id}/result`)
      .then((r) => r.json())
      .then((d) => (d.error ? setErr(d.error) : setData(d)));
  }, [id]);

  if (err) return (
    <>
      <div className="crumb"><Link href="/tests" style={{ textDecoration: "underline dotted" }}>TESTS</Link></div>
      <div className="offline-note" style={{ marginTop: 12 }}>{err}</div>
    </>
  );
  if (!data) return <p style={{ color: "var(--muted)" }}>loading…</p>;

  const pct = data.gradedMax ? Math.round((data.awarded / data.gradedMax) * 100) : 0;

  return (
    <>
      <div className="crumb"><Link href="/tests" style={{ textDecoration: "underline dotted" }}>TESTS</Link> · YOUR RESULT</div>
      <h1 className="title" style={{ marginBottom: 6 }}>{data.title}</h1>
      <div className="ready" style={{ maxWidth: 420 }}>
        <div className="barwrap"><div className="bar" style={{ width: `${pct}%` }} /></div>
        <div className="lbl">
          You scored <b>{data.awarded}/{data.gradedMax}</b> ({pct}%) on the graded parts.
          {data.pendingMax > 0 && <> <b>{data.pendingMax}</b> mark{data.pendingMax === 1 ? "" : "s"} (coding / long-answer) are still being marked by your teacher.</>}
        </div>
      </div>

      {data.items.map((it, i) => {
        if (it.pending) {
          return (
            <div className="qcard" key={i} style={{ borderLeft: "4px solid var(--muted)" }}>
              <div className="qh" style={{ display: "flex", gap: 8 }}>
                <span className="n">Q{i + 1}</span>
                <span style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: it.q }} />
                <span style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 11 }}>awaiting marking</span>
              </div>
              <div className="gradeans"><b>Your answer:</b> <span style={{ whiteSpace: "pre-wrap" }}>{it.yourAnswer}</span></div>
            </div>
          );
        }
        const full = it.awarded >= it.max && it.max > 0;
        return (
          <div className="qcard" key={i} style={{ borderLeft: `4px solid ${full ? "var(--ok)" : it.awarded > 0 ? "var(--warn)" : "var(--bad)"}` }}>
            <div className="qh" style={{ display: "flex", gap: 8 }}>
              <span className="n">Q{i + 1}</span>
              <span style={{ flex: 1 }} dangerouslySetInnerHTML={{ __html: it.q }} />
              <span className={`score ${full ? "ok" : "bad"}`}>{it.awarded}/{it.max}</span>
            </div>
            <div className="gradeans"><b>Your answer:</b> <span style={{ whiteSpace: "pre-wrap" }}>{it.yourAnswer}</span></div>
            {!full && it.correctAnswer && (
              <div className="gradeans" style={{ background: "#e7f2ec", borderLeft: "3px solid var(--accent)" }}>
                <b>Answer:</b> <span style={{ whiteSpace: "pre-wrap" }}>{it.correctAnswer}</span>
              </div>
            )}
            {it.note && <div className="aigrade" style={{ marginTop: 8 }}><b>Feedback:</b> {it.note}</div>}
          </div>
        );
      })}
    </>
  );
}
