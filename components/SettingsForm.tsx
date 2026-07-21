"use client";

import { useState } from "react";
import { DEFAULT_PROMPTS, PROMPT_PLACEHOLDERS } from "@/lib/llm/prompts";

type KeyRow = { id: string; provider: string; model: string; label: string; hasKey: boolean; newKey?: string; region?: string };
type ClientCfg = {
  keys: { id: string; provider: string; model: string; label: string; hasKey: boolean; region?: string }[];
  models: Record<string, string>;
  prompts: Record<string, string>;
  smtp?: { host: string; port: number; user: string } | null;
};

const PROVIDERS = [
  { id: "gemini", label: "Google Gemini (free tier)" },
  { id: "groq", label: "Groq (free, fast)" },
  { id: "openrouter", label: "OpenRouter (many models)" },
  { id: "anthropic", label: "Anthropic (Claude)" },
  { id: "vertex", label: "Google Vertex AI (Pro — uses GCP credits)" },
];
const MODEL_HINT: Record<string, string> = {
  gemini: "gemini-2.0-flash",
  groq: "llama-3.3-70b-versatile",
  openrouter: "meta-llama/llama-3.3-70b-instruct:free",
  anthropic: "claude-haiku-4-5",
  vertex: "gemini-2.5-pro",
};
const FEATURES: { key: string; label: string }[] = [
  { key: "tutor", label: "Tutor chat" },
  { key: "grade", label: "Grading / feedback" },
  { key: "generate", label: "Question generation" },
  { key: "oversee", label: "Student oversight (AI briefs)" },
];

export default function SettingsForm({ initial }: { initial: ClientCfg }) {
  const [keys, setKeys] = useState<KeyRow[]>(initial.keys.length ? initial.keys : []);
  const [models, setModels] = useState<Record<string, string>>(initial.models || {});
  const [prompts, setPrompts] = useState<Record<string, string>>(initial.prompts || {});
  const [smtp, setSmtp] = useState({ host: initial.smtp?.host || "", port: initial.smtp?.port ? String(initial.smtp.port) : "", user: initial.smtp?.user || "", pass: "" });
  const [status, setStatus] = useState("");

  const rid = () => Math.random().toString(36).slice(2, 10);
  const addKey = () => setKeys((k) => [...k, { id: rid(), provider: "gemini", model: "", label: "", hasKey: false }]);
  const setKey = (id: string, patch: Partial<KeyRow>) => setKeys((k) => k.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const delKey = (id: string) => setKeys((k) => k.filter((r) => r.id !== id));

  async function save() {
    setStatus("saving…");
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keys: keys.map((k) => ({ id: k.id, provider: k.provider, model: k.model || MODEL_HINT[k.provider], label: k.label, apiKey: k.newKey || undefined, region: k.region || undefined })),
        models,
        prompts,
      }),
    });
    setKeys((k) => k.map((r) => ({ ...r, newKey: undefined, hasKey: r.hasKey || !!r.newKey })));
    setStatus("saved ✓ — keys encrypted at rest");
  }

  async function testKey(k: KeyRow) {
    setStatus(`testing ${k.label || k.provider}…`);
    const r = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: k.id, provider: k.provider, apiKey: k.newKey, model: k.model || MODEL_HINT[k.provider], region: k.region }),
    }).then((x) => x.json());
    setStatus(r.message);
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {/* ── Keys / rotation ── */}
      <h2 style={{ fontFamily: "var(--serif)", fontSize: 18, margin: "8px 0 4px" }}>API keys</h2>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginBottom: 10 }}>
        Add several keys — the app tries them <b>in order and rotates to the next when one hits its rate limit</b>, so multiple
        free keys stretch your daily quota. Runs offline (canned) if none work.
      </p>

      {keys.map((k, i) => (
        <div className="classcard" key={k.id}>
          <div className="cchead">
            <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)" }}>#{i + 1}</span>
            <select className="f" style={{ maxWidth: 200 }} value={k.provider} onChange={(e) => setKey(k.id, { provider: e.target.value })}>
              {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
            <input className="f" style={{ maxWidth: 130 }} value={k.label} placeholder="label (optional)" onChange={(e) => setKey(k.id, { label: e.target.value })} />
            <span style={{ flex: 1 }} />
            <button className="tbtn2" onClick={() => testKey(k)} title="Test this key">test</button>
            <button className="tbtn2 danger" onClick={() => delKey(k.id)}>✕</button>
          </div>
          {k.provider === "vertex" ? (
            <div style={{ marginTop: 8 }}>
              <textarea
                className="f"
                rows={2}
                style={{ fontFamily: "var(--mono)", fontSize: 12 }}
                value={k.newKey || ""}
                placeholder={k.hasKey ? "•••••••• saved (blank = keep)" : "paste your Vertex AI Express Mode API key"}
                onChange={(e) => setKey(k.id, { newKey: e.target.value })}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                <input className="f" value={k.region || ""} placeholder="region (ignored for Express keys)" onChange={(e) => setKey(k.id, { region: e.target.value })} />
                <input className="f" value={k.model} placeholder={`model — e.g. ${MODEL_HINT.vertex}`} onChange={(e) => setKey(k.id, { model: e.target.value })} />
              </div>
              <p className="meta" style={{ marginTop: 6 }}>
                Easiest: <b>console.cloud.google.com/vertex-ai</b> → "Express Mode" / API keys → generate a key against your
                project with credits. No service account, no JSON, no org policy to fight.
                <br />
                (If your org allows service-account keys and you'd rather use one, paste the whole JSON here instead — it's
                auto-detected.)
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
              <input className="f" type="password" value={k.newKey || ""} placeholder={k.hasKey ? "•••••••• saved (blank = keep)" : "paste API key"} onChange={(e) => setKey(k.id, { newKey: e.target.value })} />
              <input className="f" value={k.model} placeholder={`model — e.g. ${MODEL_HINT[k.provider]}`} onChange={(e) => setKey(k.id, { model: e.target.value })} />
            </div>
          )}
        </div>
      ))}
      <button className="btn ghost" onClick={addKey}>+ Add key</button>

      {/* ── Per-task model ── */}
      <h2 style={{ fontFamily: "var(--serif)", fontSize: 18, margin: "22px 0 4px" }}>Model per task</h2>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginBottom: 10 }}>
        Optional: force a specific model for each task (leave blank to use each key's model). Handy for a cheap model on
        grading and a stronger one on the tutor.
      </p>
      {FEATURES.map((f) => (
        <label className="field" key={f.key} style={{ display: "grid", gridTemplateColumns: "180px 1fr", alignItems: "center", gap: 10, margin: "6px 0" }}>
          <span className="l" style={{ margin: 0 }}>{f.label}</span>
          <input className="f" value={models[f.key] || ""} placeholder="(use the key's model)" onChange={(e) => setModels((m) => ({ ...m, [f.key]: e.target.value }))} />
        </label>
      ))}

      {/* ── Prompts ── */}
      <h2 style={{ fontFamily: "var(--serif)", fontSize: 18, margin: "22px 0 4px" }}>AI prompts</h2>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginBottom: 10 }}>
        Edit how the AI is instructed. Blank = the built-in default. Keep the <code>{"{{placeholders}}"}</code> or they render empty.
      </p>
      {FEATURES.map((f) => (
        <div key={f.key} className="field" style={{ margin: "10px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="l" style={{ margin: 0 }}>{f.label} prompt</span>
            <span className="meta" style={{ margin: 0 }}>placeholders: {(PROMPT_PLACEHOLDERS[f.key] || []).map((p) => `{{${p}}}`).join(" ")}</span>
            <span style={{ flex: 1 }} />
            <button className="tbtn2" onClick={() => setPrompts((p) => ({ ...p, [f.key]: (DEFAULT_PROMPTS as any)[f.key] }))}>load default</button>
            <button className="tbtn2" onClick={() => setPrompts((p) => ({ ...p, [f.key]: "" }))}>reset</button>
          </div>
          <textarea className="f" rows={5} style={{ fontFamily: "var(--mono)", fontSize: 12 }} value={prompts[f.key] || ""} placeholder="Using the built-in default — type here to override…" onChange={(e) => setPrompts((p) => ({ ...p, [f.key]: e.target.value }))} />
        </div>
      ))}

      <div className="notice">
        ⚠ <b>Privacy:</b> most free tiers train on submitted prompts. Fine for lesson content and synthetic practice — weigh it
        before sending real student data.
      </div>

      {/* ── Email (SMTP) ── */}
      <h2 style={{ fontFamily: "var(--serif)", fontSize: 18, margin: "22px 0 4px" }}>Email sending (verification codes)</h2>
      <p style={{ color: "var(--muted)", fontSize: 13.5, marginBottom: 10 }}>
        Powers signup codes, email verification, and password resets. Easiest free option: your Gmail — go to{" "}
        <b>myaccount.google.com → Security → 2-Step Verification → App passwords</b>, create one for "Mail", and paste it here.
        Until this is set up, signups skip email verification.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 90px", gap: 8 }}>
        <input className="f" value={smtp.host} placeholder="smtp.gmail.com" onChange={(e) => setSmtp({ ...smtp, host: e.target.value })} />
        <input className="f" value={smtp.port} placeholder="465" onChange={(e) => setSmtp({ ...smtp, port: e.target.value })} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
        <input className="f" value={smtp.user} placeholder="your.address@gmail.com" onChange={(e) => setSmtp({ ...smtp, user: e.target.value })} />
        <input className="f" type="password" value={smtp.pass} placeholder="16-char app password (blank = keep saved)" onChange={(e) => setSmtp({ ...smtp, pass: e.target.value })} />
      </div>
      <div className="runrow" style={{ marginTop: 8 }}>
        <button
          className="btn ghost"
          onClick={async () => {
            setStatus("saving + sending test…");
            const r = await fetch("/api/settings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ smtp: { host: smtp.host || "smtp.gmail.com", port: Number(smtp.port) || 465, user: smtp.user, pass: smtp.pass || undefined, testTo: smtp.user } }),
            }).then((x) => x.json());
            setStatus(r.message || (r.ok ? "saved ✓" : "failed"));
          }}
        >
          Save email settings + send test
        </button>
      </div>

      <div className="runrow" style={{ marginTop: 14 }}>
        <button className="btn green" onClick={save}>Save all settings</button>
        {status && <span className="meta" style={{ margin: 0 }}>{status}</span>}
      </div>
    </div>
  );
}
