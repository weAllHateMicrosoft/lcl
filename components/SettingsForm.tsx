"use client";

import { useState } from "react";

type ClientCfg = {
  provider: string;
  model: string;
  models: Record<string, string>;
  hasKey: boolean;
  fallbacks: { provider: string; model: string; hasKey: boolean }[];
};

const PROVIDERS = [
  { id: "stub", label: "Offline stub (no key, canned responses)" },
  { id: "gemini", label: "Google Gemini (free tier — recommended)" },
  { id: "groq", label: "Groq (free, fast)" },
  { id: "openrouter", label: "OpenRouter (many models, one key)" },
  { id: "anthropic", label: "Anthropic (Claude)" },
];

const MODEL_HINTS: Record<string, string> = {
  gemini: "gemini-2.0-flash",
  groq: "llama-3.3-70b-versatile",
  openrouter: "meta-llama/llama-3.3-70b-instruct:free",
  anthropic: "claude-haiku-4-5",
  stub: "stub",
};

export default function SettingsForm({ initial }: { initial: ClientCfg }) {
  const [provider, setProvider] = useState(initial.provider);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(initial.model === "stub" ? "" : initial.model);
  const [models, setModels] = useState<Record<string, string>>(initial.models || {});
  const [status, setStatus] = useState("");
  const [testing, setTesting] = useState(false);

  const trainsOnData = provider !== "anthropic" && provider !== "stub";

  async function save() {
    setStatus("saving…");
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey, model: model || MODEL_HINTS[provider], models }),
    });
    setApiKey("");
    setStatus("saved ✓ — key encrypted at rest");
  }

  async function test() {
    setTesting(true);
    setStatus("testing…");
    const r = await fetch("/api/settings/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, apiKey, model: model || MODEL_HINTS[provider] }),
    }).then((x) => x.json());
    setStatus(r.message);
    setTesting(false);
  }

  return (
    <div style={{ maxWidth: 620 }}>
      <label className="field">
        <span className="l">Provider</span>
        <select className="f" value={provider} onChange={(e) => { setProvider(e.target.value); setModel(""); }}>
          {PROVIDERS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </label>

      {provider !== "stub" && (
        <>
          <label className="field">
            <span className="l">
              API key {initial.hasKey && <span className="hint">— a key is already saved; leave blank to keep it</span>}
            </span>
            <input className="f" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={initial.hasKey ? "•••••••• (unchanged)" : "paste your key"} />
          </label>

          <label className="field">
            <span className="l">Model <span className="hint">— e.g. {MODEL_HINTS[provider]}</span></span>
            <input className="f" value={model} onChange={(e) => setModel(e.target.value)} placeholder={MODEL_HINTS[provider]} />
          </label>

          <details style={{ margin: "10px 0" }}>
            <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 600 }}>Per-feature model overrides (optional)</summary>
            {(["tutor", "grade", "generate"] as const).map((f) => (
              <label className="field" key={f}>
                <span className="l" style={{ textTransform: "capitalize" }}>{f}</span>
                <input className="f" value={models[f] || ""} onChange={(e) => setModels((m) => ({ ...m, [f]: e.target.value }))} placeholder={`default: ${model || MODEL_HINTS[provider]}`} />
              </label>
            ))}
          </details>

          {trainsOnData && (
            <div className="notice">
              ⚠ <b>Privacy:</b> most free tiers train on submitted prompts. Fine for lesson content and synthetic practice — but weigh it before sending real student data through this provider (ties to your board-policy checkpoint).
            </div>
          )}
        </>
      )}

      <div className="row-btns" style={{ marginTop: 16 }}>
        <button className="btn primary" onClick={save}>Save</button>
        <button className="btn" onClick={test} disabled={testing}>Test key</button>
        {status && <span className="meta" style={{ margin: 0 }}>{status}</span>}
      </div>
    </div>
  );
}
