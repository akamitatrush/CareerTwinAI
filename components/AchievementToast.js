"use client";

// AchievementToast — micro-celebracao quando user desbloqueia conquista.
// Renderiza um toast com 8 SVGs de confetti animados via CSS puro (sem deps
// externas como react-confetti/canvas-confetti). Auto-dismiss em 5s + fade out.
//
// Acessibilidade:
//  - role="status" + aria-live=polite => SR lê quando aparece sem interromper
//  - O confetti tem aria-hidden=true (decorativo)
//  - Botao de fechar com aria-label
//  - @media (prefers-reduced-motion: reduce) cancela animacao no CSS
//
// Integracao: usado pelo NotificationsBell quando uma notificacao kind
// ACHIEVEMENT_UNLOCKED chega no fetch /api/notifications. O componente
// recebe { achievement: { title, desc, icon, points } } e onDismiss.

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function AchievementToast({ achievement, onDismiss }) {
  const [visible, setVisible] = useState(true);
  // Portal precisa de document. Sem isto, SSR renderizaria o toast inline e
  // ele herdaria o stacking/overflow do ancestral (appshell-sidebar tem
  // overflow-y:auto + height:100vh — em alguns engines, position:fixed eh
  // clipado pelo overflow do pai, deixando o toast "embaixo" do dashboard).
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    // 5s de exibicao + 300ms de fade out via animacao CSS.
    const t = setTimeout(() => {
      setVisible(false);
      const cleanup = setTimeout(() => {
        if (typeof onDismiss === "function") onDismiss();
      }, 300);
      return () => clearTimeout(cleanup);
    }, 5000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  if (!achievement || !mounted || typeof document === "undefined") return null;

  const title = typeof achievement.title === "string" ? achievement.title : "Conquista";
  const desc = typeof achievement.desc === "string" ? achievement.desc : "";
  const icon = typeof achievement.icon === "string" ? achievement.icon : "🏆";
  const points = Number.isFinite(achievement.points) ? achievement.points : 0;

  const cls = "ct-achievement-toast" + (visible ? "" : " leaving");

  const node = (
    <div className={cls} role="status" aria-live="polite">
      <div className="ct-achievement-toast-confetti" aria-hidden="true">
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            style={{ "--i": i }}
            className="ct-confetti-piece"
          />
        ))}
      </div>
      <div className="ct-achievement-toast-content">
        <div className="ct-achievement-toast-icon" aria-hidden="true">
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="ct-achievement-toast-title">Conquista desbloqueada!</p>
          <p className="ct-achievement-toast-name">{title}</p>
          <p className="ct-achievement-toast-desc">
            {desc}
            {points > 0 ? ` · +${points} pts` : ""}
          </p>
        </div>
        <button
          type="button"
          className="ct-achievement-toast-close"
          aria-label="Fechar"
          onClick={() => {
            setVisible(false);
            setTimeout(() => {
              if (typeof onDismiss === "function") onDismiss();
            }, 300);
          }}
        >
          &times;
        </button>
      </div>
    </div>
  );

  // Portal pro body — escapa do overflow:auto + sticky do appshell-sidebar.
  return createPortal(node, document.body);
}
