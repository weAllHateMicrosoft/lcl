"use client";

import { useEffect, useState } from "react";

// Light/dark toggle. Writes data-theme on <html> + localStorage. A tiny inline
// script in the layout applies it before paint to avoid a flash.
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("classos_theme", next);
    } catch {}
    setDark(!dark);
  }

  return (
    <button className="tbtn" onClick={toggle} title="Toggle dark mode" aria-label="Toggle dark mode">
      {dark ? "☀" : "☾"}
    </button>
  );
}
