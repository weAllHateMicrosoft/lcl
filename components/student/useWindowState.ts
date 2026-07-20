"use client";

import { useEffect, useState } from "react";

// One tool window's persisted state: docked to the right rail, floating freely,
// or closed. Position/size remembered per tool across lessons + reloads.
export type WinMode = "closed" | "docked" | "float";
export interface WinState {
  mode: WinMode;
  x: number;
  y: number;
  w: number;
  h: number;
}

const DEFAULTS: Record<string, WinState> = {
  scratchpad: { mode: "closed", x: 120, y: 120, w: 520, h: 460 },
  tutor: { mode: "closed", x: 220, y: 160, w: 440, h: 520 },
};

export function useWindowState(id: "scratchpad" | "tutor") {
  const [state, setState] = useState<WinState>(DEFAULTS[id]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`classos_win_${id}`);
      if (saved) setState({ ...DEFAULTS[id], ...JSON.parse(saved) });
    } catch {
      /* ignore */
    }
    setLoaded(true);
  }, [id]);

  useEffect(() => {
    if (loaded) localStorage.setItem(`classos_win_${id}`, JSON.stringify(state));
  }, [id, state, loaded]);

  const patch = (p: Partial<WinState>) => setState((s) => ({ ...s, ...p }));
  return { state, patch, loaded };
}
