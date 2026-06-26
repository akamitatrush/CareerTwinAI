"use client";

// SiteMetrics — quatro stats grandes com counter-up animation no scroll.
// requestAnimationFrame (nao setTimeout) com easing easeOutCubic.
// Duracao ~1.2s. prefers-reduced-motion: mostra valor final sem animar.
//
// Tokens-only (var(--site-*)). Em noir, o numero ganha .cloud-accent
// (lime sutil). Em claro/escuro, segue accent padrao.

import { useEffect, useRef } from "react";

const METRICS = [
  {
    value: 10,
    suffix: "s",
    prefix: "",
    label: "diagnóstico médio",
    sub: "do upload do CV ao score completo",
  },
  {
    value: 85,
    suffix: "%",
    prefix: "",
    label: "precisão do score",
    sub: "validado contra benchmark de 200 CVs",
  },
  {
    value: 1000,
    suffix: "",
    prefix: "+",
    label: "vagas no catálogo",
    sub: "indexadas de Gupy, Vagas.com e LinkedIn",
  },
  {
    value: 100,
    suffix: "%",
    prefix: "",
    label: "auditabilidade",
    sub: "cada score reproduzível na fórmula pública",
  },
];

// easeOutCubic — chega rapido, desacelera no fim. Sensação "premium".
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

// Formata o numero com separador de milhar BR quando >= 1000.
function fmt(n) {
  const rounded = Math.round(n);
  if (rounded >= 1000) return rounded.toLocaleString("pt-BR");
  return String(rounded);
}

export default function SiteMetrics() {
  const ref = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cards = ref.current?.querySelectorAll("[data-metric]") || [];

    if (reduce) {
      cards.forEach((card) => {
        const target = Number(card.dataset.target || 0);
        const numEl = card.querySelector("[data-num]");
        if (numEl) numEl.textContent = fmt(target);
        card.style.opacity = "1";
        card.style.transform = "none";
      });
      return;
    }

    cards.forEach((card) => {
      card.style.opacity = "0";
      card.style.transform = "translateY(20px)";
      card.style.transition = "opacity 700ms ease, transform 700ms ease";
    });

    const animated = new WeakSet();
    const DURATION = 1200;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          if (animated.has(entry.target)) return;
          animated.add(entry.target);

          const card = entry.target;
          const idx = Number(card.dataset.idx || 0);
          const target = Number(card.dataset.target || 0);
          const numEl = card.querySelector("[data-num]");

          setTimeout(() => {
            card.style.opacity = "1";
            card.style.transform = "translateY(0)";

            // Counter up via rAF.
            const start = performance.now();
            function tick(now) {
              const elapsed = now - start;
              const t = Math.min(1, elapsed / DURATION);
              const eased = easeOutCubic(t);
              if (numEl) numEl.textContent = fmt(target * eased);
              if (t < 1) requestAnimationFrame(tick);
              else if (numEl) numEl.textContent = fmt(target);
            }
            requestAnimationFrame(tick);
          }, idx * 90);

          io.unobserve(card);
        });
      },
      { threshold: 0.35 }
    );

    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  return (
    <section
      id="metricas"
      aria-label="CareerTwin em numeros"
      className="site-section"
      style={{
        padding: "120px 24px",
        position: "relative",
      }}
    >
      <div className="site-container" style={{ maxWidth: 1280, margin: "0 auto" }}>
        <header style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 64px" }}>
          <p
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              fontSize: 11,
              color: "var(--site-accent)",
              margin: "0 0 20px 0",
            }}
          >
            EM NÚMEROS
          </p>
          <h2
            style={{
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontSize: "clamp(32px, 4.5vw, 56px)",
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
              fontWeight: 700,
              color: "var(--site-fg)",
              margin: "0 0 16px",
            }}
          >
            Métricas reais,{" "}
            <span style={{ color: "var(--site-fg-muted)" }}>auditáveis em produção.</span>
          </h2>
          <p
            style={{
              fontSize: "clamp(15px, 1.3vw, 18px)",
              lineHeight: 1.6,
              color: "var(--site-fg-muted)",
              margin: 0,
            }}
          >
            Tudo aqui é medido em ambiente real — sem cherry-picking, sem mockup de demo.
          </p>
        </header>

        <div
          ref={ref}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          {METRICS.map((m, i) => (
            <div
              key={m.label}
              data-metric
              data-idx={i}
              data-target={m.value}
              style={{
                position: "relative",
                background: "var(--site-card-bg)",
                border: "1px solid var(--site-border)",
                borderRadius: 20,
                padding: "32px 24px",
                backdropFilter: "blur(var(--site-glass-blur))",
                WebkitBackdropFilter: "blur(var(--site-glass-blur))",
                overflow: "hidden",
                textAlign: "left",
              }}
            >
              {/* halo sutil topo direito */}
              <div
                aria-hidden="true"
                style={{
                  position: "absolute",
                  top: -40,
                  right: -40,
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, var(--site-mesh-cyan), transparent 70%)",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 2,
                  marginBottom: 16,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {m.prefix && (
                  <span
                    className="cloud-accent"
                    style={{
                      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                      fontSize: "clamp(32px, 4vw, 48px)",
                      fontWeight: 700,
                      letterSpacing: "-0.03em",
                      lineHeight: 1,
                    }}
                  >
                    {m.prefix}
                  </span>
                )}
                <span
                  data-num
                  className="cloud-accent"
                  style={{
                    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                    fontSize: "clamp(48px, 7vw, 88px)",
                    fontWeight: 700,
                    letterSpacing: "-0.045em",
                    lineHeight: 1,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  0
                </span>
                {m.suffix && (
                  <span
                    style={{
                      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                      fontSize: "clamp(24px, 3vw, 36px)",
                      fontWeight: 600,
                      letterSpacing: "-0.02em",
                      lineHeight: 1,
                      color: "var(--site-fg)",
                    }}
                  >
                    {m.suffix}
                  </span>
                )}
              </div>
              <p
                style={{
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--site-fg)",
                  margin: "0 0 6px",
                  letterSpacing: "-0.01em",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {m.label}
              </p>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: "var(--site-fg-dim)",
                  margin: 0,
                  position: "relative",
                  zIndex: 1,
                }}
              >
                {m.sub}
              </p>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          [data-metric] {
            opacity: 1 !important;
            transform: none !important;
            transition: none !important;
          }
        }
      `}</style>
    </section>
  );
}
