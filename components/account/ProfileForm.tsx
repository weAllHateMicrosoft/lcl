"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Edit display name + avatar. Picking a file opens a cropper (drag to position,
// slider to zoom); the chosen square is exported to a tiny 128px data URL.
export default function ProfileForm({ initialName, initialAvatar }: { initialName: string; initialAvatar: string | null }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [avatar, setAvatar] = useState<string | null>(initialAvatar);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function save() {
    setMsg("saving…");
    const r = await fetch("/api/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, avatar }) });
    const d = await r.json();
    setMsg(r.ok ? "saved ✓" : d.error || "failed");
    if (r.ok) router.refresh();
  }

  return (
    <div style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap" }}>
      <div style={{ textAlign: "center" }}>
        <div className="avatar-lg">{avatar ? <img src={avatar} alt="" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}</div>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && pickFile(e.target.files[0])} />
        <div style={{ display: "flex", gap: 6, marginTop: 8, justifyContent: "center" }}>
          <button className="tbtn2" onClick={() => fileRef.current?.click()}>Upload</button>
          {avatar && <button className="tbtn2 danger" onClick={() => setAvatar(null)}>Remove</button>}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <label className="field">
          <span className="l">Display name</span>
          <input className="f" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="runrow">
          <button className="btn green" onClick={save}>Save profile</button>
          {msg && <span className="meta" style={{ margin: 0 }}>{msg}</span>}
        </div>
      </div>

      {cropSrc && (
        <AvatarCropper
          src={cropSrc}
          onCancel={() => setCropSrc(null)}
          onSave={(dataUrl) => {
            setAvatar(dataUrl);
            setCropSrc(null);
          }}
        />
      )}
    </div>
  );
}

const V = 220; // cropper viewport size

function AvatarCropper({ src, onCancel, onSave }: { src: string; onCancel: () => void; onSave: (d: string) => void }) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  const base = nat.w && nat.h ? V / Math.min(nat.w, nat.h) : 1;
  const dScale = base * zoom;
  const dW = nat.w * dScale;
  const dH = nat.h * dScale;

  const clamp = (p: { x: number; y: number }) => ({ x: Math.min(0, Math.max(V - dW, p.x)), y: Math.min(0, Math.max(V - dH, p.y)) });

  // center on load; re-clamp when zoom changes
  useEffect(() => {
    if (nat.w) setPos(clamp({ x: (V - dW) / 2, y: (V - dH) / 2 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nat.w, nat.h]);
  useEffect(() => {
    if (nat.w) setPos((p) => clamp(p));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  function down(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, ox: pos.x, oy: pos.y };
  }
  function move(e: React.PointerEvent) {
    if (!drag.current || e.buttons !== 1) return;
    setPos(clamp({ x: drag.current.ox + (e.clientX - drag.current.px), y: drag.current.oy + (e.clientY - drag.current.py) }));
  }

  function save() {
    const img = imgRef.current;
    if (!img) return;
    const out = 128;
    const c = document.createElement("canvas");
    c.width = out;
    c.height = out;
    const ctx = c.getContext("2d")!;
    const s = V / dScale; // source square size in natural px
    ctx.drawImage(img, -pos.x / dScale, -pos.y / dScale, s, s, 0, 0, out, out);
    onSave(c.toDataURL("image/jpeg", 0.82));
  }

  return (
    <div className="overlay" onClick={onCancel}>
      <div className="sebwin" style={{ maxWidth: 300 }} onClick={(e) => e.stopPropagation()}>
        <div className="sebbody" style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: 18, marginBottom: 4 }}>Position your photo</h2>
          <p className="sub" style={{ marginBottom: 12 }}>Drag to move · slider to zoom</p>
          <div className="cropview" style={{ width: V, height: V }} onPointerDown={down} onPointerMove={move}>
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={(e) => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              style={{ position: "absolute", left: pos.x, top: pos.y, width: dW, height: dH, maxWidth: "none" }}
            />
            <div className="cropring" />
          </div>
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ width: V, margin: "12px 0" }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button className="btn green" onClick={save}>Use photo</button>
            <button className="btn ghost" onClick={onCancel}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
}
