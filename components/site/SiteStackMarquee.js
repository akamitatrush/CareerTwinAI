"use client";

// SiteStackMarquee — banda horizontal infinita com palavras-chave do produto.
// Render duplicado pra emendar a animacao sem corte (translateX -50% conclui
// um ciclo completo). Pause-on-hover via CSS. prefers-reduced-motion: anima
// off, mostra texto estatico centralizado.
//
// Server component nao serve aqui porque usamos CSS-in-component via <style>
// inline pra manter o keyframes local (sem tocar globals.css). E hover precisa
// do estado :hover puro CSS, que tambem entra no <style> inline.

const KEYWORDS = [
  "Diagnóstico",
  "Skill Map",
  "Roadmap",
  "Vagas reais",
  "Microações",
  "Score auditável",
  "RAG curado BR",
  "Embeddings",
  "Vagas BR",
  "CV adaptado",
  "Mock interview",
  "Funil de candidaturas",
  "LGPD-first",
  "Streaming SSE",
];

export default function SiteStackMarquee() {
  // Cada palavra com separador. Renderizamos a sequencia duas vezes pra emendar
  // a animacao (track de 200% width, animacao vai de 0 a -50%).
  const items = KEYWORDS.map((w, i) => (
    <span
      key={`${w}-${i}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 28,
        paddingRight: 28,
      }}
    >
      <span style={{ color: "var(--site-fg-dim)" }}>{w}</span>
      <span
        aria-hidden="true"
        style={{
          color: "var(--site-accent)",
          fontSize: "0.7em",
          opacity: 0.65,
        }}
      >
        ◆
      </span>
    </span>
  ));

  return (
    <section
      aria-label="Capacidades do CareerTwin"
      className="site-marquee-section"
      style={{
        padding: "64px 0",
        position: "relative",
        borderTop: "1px solid var(--site-border)",
        borderBottom: "1px solid var(--site-border)",
        overflow: "hidden",
      }}
    >
      {/* Fade nas bordas — mascara CSS lateral. */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "linear-gradient(90deg, var(--site-bg) 0%, transparent 8%, transparent 92%, var(--site-bg) 100%)",
          zIndex: 2,
        }}
      />

      <div
        className="site-marquee-viewport"
        style={{
          width: "100%",
          overflow: "hidden",
        }}
      >
        <div
          className="site-marquee-track"
          aria-hidden="false"
          style={{
            display: "inline-flex",
            whiteSpace: "nowrap",
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            fontWeight: 700,
            fontSize: "clamp(32px, 5vw, 64px)",
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            lineHeight: 1.1,
            willChange: "transform",
          }}
        >
          <span style={{ display: "inline-flex", alignItems: "center", gap: 0 }}>
            {items}
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 0 }} aria-hidden="true">
            {items}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes siteMarqueeScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .site-marquee-track {
          animation: siteMarqueeScroll 38s linear infinite;
        }
        .site-marquee-section:hover .site-marquee-track {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .site-marquee-track {
            animation: none !important;
            transform: translateX(0) !important;
          }
        }
      `}</style>
    </section>
  );
}
