"use client";

// Window chrome shared by every student tool: a title bar you drag to move
// (drag a docked window away and it floats), OS-style controls (dock ⇥ / float ⧉
// / close ✕), and a resize grip. Pure presentation + interaction; the tool's
// content is passed as children.

import { useRef } from "react";
import type { WinState } from "./useWindowState";

export default function FloatingWindow({
  title,
  icon,
  state,
  patch,
  onClose,
  children,
}: {
  title: string;
  icon: string;
  state: WinState;
  patch: (p: Partial<WinState>) => void;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const drag = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const resize = useRef<{ px: number; py: number; ow: number; oh: number } | null>(null);

  function onTitleDown(e: React.PointerEvent) {
    if (e.button !== 0) return; // primary button only
    // Dragging always pops a docked window into a float at the cursor.
    e.currentTarget.setPointerCapture(e.pointerId);
    const startX = state.mode === "docked" ? window.innerWidth - state.w - 24 : state.x;
    const startY = state.mode === "docked" ? 80 : state.y;
    drag.current = { px: e.clientX, py: e.clientY, ox: startX, oy: startY };
    if (state.mode === "docked") patch({ mode: "float", x: startX, y: startY });
  }
  function onTitleMove(e: React.PointerEvent) {
    // e.buttons check is the fix for the "window follows the hovering mouse"
    // bug: if the button is no longer held (missed pointerup), stop dragging.
    if (!drag.current) return;
    if (e.buttons !== 1) {
      drag.current = null;
      return;
    }
    patch({
      x: Math.max(0, drag.current.ox + (e.clientX - drag.current.px)),
      y: Math.max(57, drag.current.oy + (e.clientY - drag.current.py)),
    });
  }
  function onTitleUp() {
    drag.current = null;
  }

  function onResizeDown(e: React.PointerEvent) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    resize.current = { px: e.clientX, py: e.clientY, ow: state.w, oh: state.h };
  }
  function onResizeMove(e: React.PointerEvent) {
    if (!resize.current) return;
    if (e.buttons !== 1) {
      resize.current = null;
      return;
    }
    patch({
      w: Math.max(340, resize.current.ow + (e.clientX - resize.current.px) * (state.mode === "docked" ? -1 : 1)),
      h: state.mode === "docked" ? state.h : Math.max(280, resize.current.oh + (e.clientY - resize.current.py)),
    });
  }
  function onResizeUp() {
    resize.current = null;
  }

  const docked = state.mode === "docked";
  const style: React.CSSProperties = docked
    ? { position: "fixed", top: 57, right: 0, bottom: 0, width: state.w, zIndex: 46 }
    : { position: "fixed", top: state.y, left: state.x, width: state.w, height: state.h, zIndex: 47 };

  return (
    <div className={`toolwin ${docked ? "docked" : "floating"}`} style={style}>
      <div
        className="toolbar"
        onPointerDown={onTitleDown}
        onPointerMove={onTitleMove}
        onPointerUp={onTitleUp}
        onPointerCancel={onTitleUp}
        onLostPointerCapture={onTitleUp}
      >
        <span className="ttitle">
          {icon} {title}
        </span>
        <span style={{ flex: 1 }} />
        {docked ? (
          <button className="tctl" title="Float" onPointerDown={(e) => e.stopPropagation()} onClick={() => patch({ mode: "float" })}>
            ⧉
          </button>
        ) : (
          <button className="tctl" title="Dock to side" onPointerDown={(e) => e.stopPropagation()} onClick={() => patch({ mode: "docked" })}>
            ⇥
          </button>
        )}
        <button className="tctl" title="Close" onPointerDown={(e) => e.stopPropagation()} onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="toolbody">{children}</div>
      <div
        className={`resizer ${docked ? "left" : "corner"}`}
        onPointerDown={onResizeDown}
        onPointerMove={onResizeMove}
        onPointerUp={onResizeUp}
        onPointerCancel={onResizeUp}
        onLostPointerCapture={onResizeUp}
      />
    </div>
  );
}
