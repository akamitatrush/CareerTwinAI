"use client";

// Grid 3x2 de features. Cada card glassmorphism com icone SVG inline +
// titulo bold + descricao + frase-killer em italico.
// Fade-up on viewport entry via IntersectionObserver (single observer pra
// todos os cards — barato).

import { useEffect, useRef } from "react";

const FEATURES = [
  {
    title: "Score auditável",
    desc: "Career Health Score com fórmula pública. Sub-scores em fit, market, growth, network e brand.",
    quote: "Você pode reproduzir cada cálculo no papel.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 17l5-5 4 4 8-8" />
        <path d="M14 8h6v6" />
        <circle cx="3" cy="17" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="8" cy="12" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="12" cy="16" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="20" cy="8" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    ),
    accent: "#70FFDD",
  },
  {
    title: "RAG curado BR",
    desc: "159 chunks brasileiros indexados, Recall@3 de 93,9%. Cada microação cita a fonte original.",
    quote: "Conselho com fonte, não opinião alucinada.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 4h12a3 3 0 0 1 3 3v13" />
        <path d="M4 4v15a2 2 0 0 0 2 2h13" />
        <path d="M8 9h7M8 13h5" />
      </svg>
    ),
    accent: "#70FFDD",
  },
  {
    title: "Modo experimentar",
    desc: "Diagnóstico completo em ~10s sem login. CV efêmero em memória, nada persistido até você decidir.",
    quote: "Sem fricção, sem dado armazenado.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
    accent: "#B924FF",
  },
  {
    title: "LGPD by-design",
    desc: "21 ações auditadas, IP nunca em raw (hash + salt), TTL de 90 dias no texto do CV. Direito de exportação e exclusão em 1 clique.",
    quote: "Você é o cliente, não o produto.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3l8 3v6c0 4.5-3.4 8.4-8 9-4.6-.6-8-4.5-8-9V6l8-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
    accent: "#70FFDD",
  },
  {
    title: "Streaming SSE",
    desc: "Etapas progressivas em tempo real — validando, analisando, calculando, persistindo. Você acompanha o pipeline.",
    quote: "Você vê o trabalho, não tela branca de loading.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 17l4-4 3 3 5-5 4 4" />
        <path d="M4 21h16" />
      </svg>
    ),
    accent: "#B924FF",
  },
  {
    title: "Marketplace neutro",
    desc: "Recomenda Tera, Alura, Coursera, FreeCodeCamp por aderência ao seu gap — sem comissão, sem viés.",
    quote: "Sem viés comercial.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 7l9-4 9 4-9 4-9-4z" />
        <path d="M3 12l9 4 9-4" />
        <path d="M3 17l9 4 9-4" />
      </svg>
    ),
    accent: "#70FFDD",
  },
];

export default function SiteFeatures() {
  const gridRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cards = gridRef.current?.querySelectorAll("[data-feature-card]") || [];
    if (reduce) {
      cards.forEach((c) => {
        c.style.opacity = "1";
        c.style.transform = "none";
      });
      return;
    }
    cards.forEach((c) => {
      c.style.opacity = "0";
      c.style.transform = "translateY(24px)";
      c.style.transition = "opacity 700ms ease, transform 700ms ease";
    });

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const idx = Number(entry.target.dataset.idx || 0);
          setTimeout(() => {
            entry.target.style.opacity = "1";
            entry.target.style.transform = "translateY(0)";
          }, idx * 80);
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );

    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  return (
    <section
      id="features"
      className="site-section"
      style={{
        padding: "140px 24px",
        position: "relative",
      }}
    >
      <div
        className="site-container"
        style={{ maxWidth: 1280, margin: "0 auto" }}
      >
        <header style={{ maxWidth: 720, marginBottom: 80 }}>
          <p
            className="site-eyebrow"
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              fontSize: 11,
              color: "#70FFDD",
              margin: "0 0 20px 0",
            }}
          >
            FEATURES
          </p>
          <h2
            className="site-h2"
            style={{
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontSize: "clamp(36px, 5vw, 64px)",
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
              fontWeight: 700,
              color: "#FAFAFC",
              margin: "0 0 24px",
            }}
          >
            Tudo o que outras ferramentas escondem,{" "}
            <span style={{ color: "#A0A0AB" }}>nós deixamos auditável.</span>
          </h2>
          <p
            className="site-body-lg"
            style={{
              fontSize: "clamp(16px, 1.4vw, 20px)",
              lineHeight: 1.55,
              color: "#A0A0AB",
              margin: 0,
            }}
          >
            Cada decisão técnica do CareerTwin existe pra responder uma pergunta
            difícil de quem usa: <em style={{ color: "#FAFAFC", fontStyle: "normal" }}>por quê</em>?
          </p>
        </header>

        <div
          ref={gridRef}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: 20,
          }}
        >
          {FEATURES.map((f, i) => (
            <article
              key={f.title}
              data-feature-card
              data-idx={i}
              className="site-card-glass"
              style={{
                position: "relative",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 20,
                padding: 32,
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                overflow: "hidden",
                transition: "transform 300ms ease, border-color 300ms ease, background 300ms ease, opacity 700ms ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.14)";
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
                e.currentTarget.style.background = "rgba(255,255,255,0.03)";
              }}
            >
              {/* sutil halo do accent no canto */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: -40,
                  right: -40,
                  width: 140,
                  height: 140,
                  borderRadius: "50%",
                  background: f.accent === "#70FFDD"
                    ? "radial-gradient(circle, rgba(112,255,221,0.10), transparent 70%)"
                    : "radial-gradient(circle, rgba(185,36,255,0.10), transparent 70%)",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: f.accent,
                  marginBottom: 24,
                }}
              >
                <span style={{ display: "inline-flex", width: 22, height: 22 }}>
                  {f.icon}
                </span>
              </div>
              <h3
                style={{
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                  fontSize: 22,
                  lineHeight: 1.2,
                  letterSpacing: "-0.015em",
                  fontWeight: 600,
                  color: "#FAFAFC",
                  margin: "0 0 12px",
                }}
              >
                {f.title}
              </h3>
              <p
                style={{
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: "#A0A0AB",
                  margin: "0 0 18px",
                }}
              >
                {f.desc}
              </p>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: "#FAFAFC",
                  margin: 0,
                  fontStyle: "italic",
                  borderLeft: `2px solid ${f.accent}`,
                  paddingLeft: 12,
                }}
              >
                {f.quote}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
