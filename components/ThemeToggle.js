"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";

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
      {theme === "noir" && <Icon name="theme-dot" size={16} filled />}
      {theme === "light" && <Icon name="theme-sun" size={16} stroke={2} />}
      {theme === "dark" && <Icon name="theme-moon" size={16} stroke={2} />}
    </button>
  );
}
