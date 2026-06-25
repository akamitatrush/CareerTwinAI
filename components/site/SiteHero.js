"use client";

// Hero — Cloudwalk/Apple BR vibe. Typography como protagonista.
// Tres pecas que precisam estar perfeitas:
//   1. H-display gigante (clamp 64-160px) com tracking apertado
//   2. Gradient mesh atras, NUNCA sobreposto ao texto
//   3. Scroll cue sutil — eyebrow + chevron animado
//
// "Use client" porque temos um SVG decorativo que respeita prefers-reduced-motion,
// e o IntersectionObserver pro fade-up dos elementos. Sem JS, ainda renderiza
// completo (graceful degradation).

import { useEffect, useRef } from "react";
import Link from "next/link";

export default function SiteHero() {
  const containerRef = useRef(null);

  useEffect(() => {
    // Fade-up sequencial dos elementos do hero quando entram em view.
    // Como o hero ja esta visivel no load, o observer dispara imediatamente.
    // Delay escalonado vem do data-delay no DOM.
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const els = containerRef.current?.querySelectorAll("[data-fade]") || [];
    if (reduce) {
      els.forEach((el) => {
        el.style.opacity = "1";
        el.style.transform = "none";
      });
      return;
    }
    els.forEach((el, i) => {
      el.style.opacity = "0";
      el.style.transform = "translateY(16px)";
      el.style.transition = "opacity 700ms ease, transform 700ms ease";
      const delay = 90 * i;
      setTimeout(() => {
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      }, delay + 80);
    });
  }, []);

  return (
    <section
      ref={containerRef}
      style={{
        position: "relative",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "160px 24px 80px",
        overflow: "hidden",
      }}
    >
      {/* Gradient mesh — z=0, atras de tudo */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(at 30% 20%, var(--site-mesh-cyan), transparent 50%), radial-gradient(at 80% 60%, var(--site-mesh-magenta), transparent 60%)",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      {/* Grain noise sutil (Apple-like) */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.04,
          mixBlendMode: "overlay",
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2'/></filter><rect width='200' height='200' filter='url(%23n)' opacity='0.7'/></svg>\")",
          pointerEvents: "none",
          zIndex: 0,
        }}
      />

      <div style={{ position: "relative", zIndex: 2, maxWidth: 1100, width: "100%" }}>
        <p
          className="site-eyebrow"
          data-fade
          style={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            textTransform: "uppercase",
            letterSpacing: "0.18em",
            fontSize: 11,
            color: "var(--site-fg-muted)",
            margin: "0 0 28px 0",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--site-accent)",
              marginRight: 10,
              verticalAlign: "middle",
              boxShadow: "0 0 12px var(--site-accent-glow)",
            }}
          />
          PRODUTO BR · LGPD-FIRST · AUDITÁVEL
        </p>

        <h1
          className="site-h-display"
          data-fade
          style={{
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontSize: "clamp(48px, 9.5vw, 144px)",
            lineHeight: 0.95,
            letterSpacing: "-0.035em",
            fontWeight: 700,
            color: "var(--site-fg)",
            margin: "0 auto 32px",
            maxWidth: "16ch",
          }}
        >
          Sua carreira merece um copiloto que entende o{" "}
          <span
            style={{
              background:
                "linear-gradient(120deg, var(--site-accent) 0%, var(--site-accent-magenta) 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              display: "inline-block",
            }}
          >
            mercado brasileiro.
          </span>
        </h1>

        <p
          className="site-body-lg"
          data-fade
          style={{
            fontSize: "clamp(17px, 1.6vw, 22px)",
            lineHeight: 1.5,
            color: "var(--site-fg-muted)",
            maxWidth: 720,
            margin: "0 auto 48px",
            fontWeight: 400,
          }}
        >
          CareerTwin AI: diagnóstico auditável, vagas reais, microações com fonte.
          Sem caixa-preta, sem alucinação.
        </p>

        <div
          data-fade
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            flexWrap: "wrap",
            marginBottom: 60,
          }}
        >
          <Link
            href="/experimentar"
            className="site-btn-primary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "16px 28px",
              borderRadius: 999,
              background: "var(--site-accent)",
              color: "var(--site-bg)",
              fontWeight: 600,
              fontSize: 15,
              textDecoration: "none",
              border: "1px solid var(--site-accent)",
              boxShadow: "0 0 40px var(--site-accent-glow)",
              transition: "transform 200ms ease, box-shadow 200ms ease",
            }}
          >
            Começar diagnóstico grátis
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </Link>
          <a
            href="#como-funciona"
            className="site-btn-secondary"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "16px 28px",
              borderRadius: 999,
              background: "var(--site-card-bg)",
              color: "var(--site-fg)",
              fontWeight: 500,
              fontSize: 15,
              textDecoration: "none",
              border: "1px solid var(--site-border-strong)",
            }}
          >
            Ver como funciona
          </a>
        </div>

        {/* Hero SVG decorativo — trajetória abstrata. Sem pessoa, sem clichê.
            Linhas representando "caminho" + pontos de inflexão (decisões). */}
        <div
          data-fade
          aria-hidden="true"
          style={{
            maxWidth: 880,
            margin: "0 auto",
            opacity: 0.9,
          }}
        >
          <svg viewBox="0 0 880 240" width="100%" height="auto" role="presentation">
            <defs>
              <linearGradient id="ctTraj" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--site-accent)" stopOpacity="0" />
                <stop offset="20%" stopColor="var(--site-accent)" stopOpacity="0.9" />
                <stop offset="55%" stopColor="var(--site-fg)" stopOpacity="0.85" />
                <stop offset="85%" stopColor="var(--site-accent-magenta)" stopOpacity="0.9" />
                <stop offset="100%" stopColor="var(--site-accent-magenta)" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="ctBaseline" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--site-fg)" stopOpacity="0" />
                <stop offset="50%" stopColor="var(--site-fg)" stopOpacity="0.10" />
                <stop offset="100%" stopColor="var(--site-fg)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* baseline (mercado medio) */}
            <line x1="0" y1="170" x2="880" y2="170" stroke="url(#ctBaseline)" strokeWidth="1" strokeDasharray="2 6" />

            {/* trajetoria principal */}
            <path
              d="M 20 200 C 140 180, 220 160, 320 130 S 540 60, 680 80 S 820 50, 860 40"
              stroke="url(#ctTraj)"
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
            />

            {/* trajetoria fantasma — "voce hoje" */}
            <path
              d="M 20 200 C 140 200, 220 195, 320 188 S 540 175, 680 168 S 820 160, 860 158"
              stroke="var(--site-border-strong)"
              strokeWidth="1"
              strokeDasharray="3 4"
              fill="none"
            />

            {/* pontos de inflexao */}
            {[
              { x: 20, y: 200, c: "var(--site-accent)" },
              { x: 320, y: 130, c: "var(--site-fg)" },
              { x: 540, y: 70, c: "var(--site-fg)" },
              { x: 680, y: 80, c: "var(--site-fg)" },
              { x: 860, y: 40, c: "var(--site-accent-magenta)" },
            ].map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r="10" fill={p.c} opacity="0.12" />
                <circle cx={p.x} cy={p.y} r="4" fill={p.c} />
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* Scroll cue */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: 32,
          left: "50%",
          transform: "translateX(-50%)",
          color: "var(--site-fg-dim)",
          fontSize: 11,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          zIndex: 2,
        }}
      >
        <span>scroll</span>
        <svg
          width="14"
          height="20"
          viewBox="0 0 14 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ animation: "siteHeroChevron 1.6s ease-in-out infinite" }}
        >
          <path d="M7 2v14M2 11l5 5 5-5" />
        </svg>
        <style>{`
          @keyframes siteHeroChevron {
            0%, 100% { transform: translateY(0); opacity: 0.7; }
            50% { transform: translateY(4px); opacity: 1; }
          }
          @media (prefers-reduced-motion: reduce) {
            [style*="siteHeroChevron"] { animation: none !important; }
          }
        `}</style>
      </div>
    </section>
  );
}
