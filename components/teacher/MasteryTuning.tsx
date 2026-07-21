"use client";

import { useState } from "react";
import type { MasteryConfig } from "@/lib/mastery";

// Admin-only knobs for the mastery judgement — placed right where you see its
// effect. Your standing requirement: the AI's judgement is never buried logic.
const FIELDS: { key: keyof MasteryConfig; label: string; hint: string; step: number; min: number; max: number }[] = [
  { key: "strongAt", label: "“Strong” threshold", hint: "estimate at/above this (when confident) reads as strong", step: 0.05, min: 0.5, max: 1 },
  { key: "minConfidence", label: "Min confidence to judge", hint: "below this → “not enough evidence” instead of a verdict", step: 0.05, min: 0.1, max: 1 },
  { key: "targetEvidence", label: "Evidence for full confidence", hint: "how many (recency-weighted) answers count as “enough”", step: 1, min: 1, max: 10 },
  { key: "halfLifeDays", label: "Evidence half-life (days)", hint: "how fast old answers stop counting", step: 1, min: 1, max: 90 },
];

export default function MasteryTuning({ initial }: { initial: MasteryConfig }) {
  const [cfg, setCfg] = useState<MasteryConfig>(initial);
  const [status, setStatus] = useState("");

  async function save() {
    setStatus("saving…");
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mastery: cfg }),
    });
    setStatus("saved ✓ — reload to see it re-scored");
  }

  return (
    <details className="panel" style={{ marginTop: 20 }}>
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>⚙ Mastery tuning (admin)</summary>
      <p className="meta" style={{ marginTop: 8 }}>
        These are the knobs behind every judgement above. Nothing is hardcoded — dial them to match how strict you want to be.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
        {FIELDS.map((f) => (
          <label key={f.key} className="field" style={{ margin: 0 }}>
            <span className="l">{f.label}</span>
            <input
              className="f"
              type="number"
              step={f.step}
              min={f.min}
              max={f.max}
              value={cfg[f.key]}
              onChange={(e) => setCfg((c) => ({ ...c, [f.key]: Number(e.target.value) }))}
            />
            <span className="meta">{f.hint}</span>
          </label>
        ))}
      </div>
      <div className="runrow" style={{ marginTop: 10 }}>
        <button className="btn green" onClick={save}>Save thresholds</button>
        {status && <span className="meta" style={{ margin: 0 }}>{status}</span>}
      </div>
    </details>
  );
}
