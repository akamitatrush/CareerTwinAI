"use client";

// Cursor glow estilo Linear — um halo radial cyan suave seguindo o mouse.
// Three contraints crítico:
//   1. perf: usamos requestAnimationFrame + transform (GPU), NUNCA top/left
//   2. acessibilidade: respeita prefers-reduced-motion (omite glow inteiro)
//   3. mobile: media query inline (display:none < 768px) — touch nao tem mouse
//
// Renderiza nada no servidor pra evitar mismatch SSR/CSR — o useEffect monta
// só no client, e mesmo assim só se o usuario nao optou por reduzir motion.

import { useEffect, useRef, useState } from "react";

export default function SiteCursorGlow() {
  const ref = useRef(null);
  const rafRef = useRef(0);
  const targetRef = useRef({ x: -1000, y: -1000 });
  const currentRef = useRef({ x: -1000, y: -1000 });
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    // Detecta reduce-motion + mobile (mobile == sem hover/pointer fino).
    // matchMedia retorna live-list que poderia mudar (acessibilidade do OS),
    // mas em prod o usuario nao alterna em runtime — basta checar 1x.
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const noPointer = window.matchMedia("(hover: none), (pointer: coarse)").matches;
    if (reduce || noPointer) return;
    setEnabled(true);

    function onMove(e) {
      targetRef.current.x = e.clientX;
      targetRef.current.y = e.clientY;
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    function tick() {
      // Lerp suave — current se aproxima de target com fator 0.18.
      // Sensacao "magnetica" sem ficar grudado no cursor (que daria feel
      // de elemento sólido, nao de luz).
      const t = targetRef.current;
      const c = currentRef.current;
      c.x += (t.x - c.x) * 0.18;
      c.y += (t.y - c.y) * 0.18;
      if (ref.current) {
        ref.current.style.transform =
          `translate3d(${c.x - 300}px, ${c.y - 300}px, 0)`;
      }
      const dx = Math.abs(t.x - c.x);
      const dy = Math.abs(t.y - c.y);
      if (dx < 0.5 && dy < 0.5) {
        rafRef.current = 0;
      } else {
        rafRef.current = requestAnimationFrame(tick);
      }
    }

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!enabled) return null;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: 600,
        height: 600,
        borderRadius: "50%",
        background:
          "radial-gradient(circle, rgba(112,255,221,0.10), rgba(112,255,221,0.04) 35%, transparent 70%)",
        pointerEvents: "none",
        zIndex: 1,
        mixBlendMode: "screen",
        willChange: "transform",
        transform: "translate3d(-1000px, -1000px, 0)",
      }}
    />
  );
}
