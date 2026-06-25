"use client";

import { useEffect, useState } from "react";

// Ordem do ciclo: noir (default) → light → dark → noir → ...
// Clique único avança pro próximo. Mais limpo que dropdown e suficiente
// pra UX — 3 estados ainda é descoberta rápida pelo usuário.
const ORDER = ["noir", "light", "dark"];

const LABEL = {
  noir: "noir (P&B)",
  light: "claro",
  dark: "escuro",
};

function nextTheme(current) {
  const idx = ORDER.indexOf(current);
  return ORDER[(idx + 1) % ORDER.length];
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState("noir");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let saved = null;
    try {
      saved = localStorage.getItem("ct_theme");
    } catch {}
    const current = ORDER.includes(saved) ? saved : "noir";
    setTheme(current);
    document.documentElement.setAttribute("data-theme", current);
  }, []);

  function toggle() {
    const next = nextTheme(theme);
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("ct_theme", next);
    } catch {}
  }

  if (!mounted) return null;

  const upcoming = nextTheme(theme);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Tema atual: ${LABEL[theme]}. Trocar pra ${LABEL[upcoming]}.`}
      title={`Tema: ${LABEL[theme]} → ${LABEL[upcoming]}`}
      className="theme-toggle"
    >
      {theme === "noir" && (
        /* círculo preenchido — noir P&B */
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
        </svg>
      )}
      {theme === "light" && (
        /* sol */
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      )}
      {theme === "dark" && (
        /* lua crescente */
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}
