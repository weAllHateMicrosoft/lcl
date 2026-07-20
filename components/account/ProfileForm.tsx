"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Edit display name + avatar. The avatar is downscaled to 128px in the browser
// so we store a tiny data URL (no file hosting needed).
export default function ProfileForm({ initialName, initialAvatar }: { initialName: string; initialAvatar: string | null }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [avatar, setAvatar] = useState<string | null>(initialAvatar);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 128;
        const c = document.createElement("canvas");
        c.width = size;
        c.height = size;
        const ctx = c.getContext("2d")!;
        const s = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        setAvatar(c.toDataURL("image/jpeg", 0.82));
      };
      img.src = reader.result as string;
    };
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
    </div>
  );
}
