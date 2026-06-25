"use client";

// Pricing 3-tier Cloudwalk-style. Card Pro destacado (border accent + glow).
// Honesto: Free continua util, Pro é o sweet spot, Team é "futuro".

import { useEffect, useRef } from "react";
import Link from "next/link";

const TIERS = [
  {
    name: "Free",
    price: "R$ 0",
    period: "pra sempre",
    description: "Experimente sem cadastro. Com conta, ganhe persistência e histórico.",
    features: [
      "Modo experimentar ilimitado",
      "3 diagnósticos/mês com conta",
      "Score auditável + sub-scores",
      "Vagas reais com aderência",
      "Modo claro/escuro",
    ],
    cta: "Começar grátis",
    href: "/experimentar",
    highlight: false,
  },
  {
    name: "Pro",
    price: "R$ 49",
    period: "/mês",
    description: "Pra quem está em transição ativa e precisa de iteração rápida.",
    features: [
      "Diagnósticos ilimitados",
      "Refresh contínuo (recalcule sempre)",
      "CV Adapter — adapta CV pra cada vaga",
      "Mock interview com Claude",
      "Funil de candidaturas completo",
      "Análise de gaps com microação + fonte",
      "Suporte por e-mail prioritário",
    ],
    cta: "Assinar Pro",
    href: "/entrar?plano=pro",
    highlight: true,
  },
  {
    name: "Team",
    price: "R$ 99",
    period: "/seat/mês",
    description: "Pra times de carreira, RH ou bootcamps (em breve).",
    features: [
      "Tudo do Pro",
      "Multi-seat com gestão",
      "Analytics consolidado",
      "Branding white-label",
      "Onboarding dedicado",
      "SLA contratual",
    ],
    cta: "Entrar na lista",
    href: "/entrar?plano=team",
    highlight: false,
    badge: "Em breve",
  },
];

export default function SitePricing() {
  const ref = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const cards = ref.current?.querySelectorAll("[data-tier]") || [];
    if (reduce) {
      cards.forEach((c) => { c.style.opacity = "1"; c.style.transform = "none"; });
      return;
    }
    cards.forEach((c) => {
      c.style.opacity = "0";
      c.style.transform = "translateY(28px)";
      c.style.transition = "opacity 700ms ease, transform 700ms ease";
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const idx = Number(entry.target.dataset.idx || 0);
        setTimeout(() => {
          entry.target.style.opacity = "1";
          entry.target.style.transform = "translateY(0)";
        }, idx * 100);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.15 });
    cards.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);

  return (
    <section
      id="precos"
      ref={ref}
      className="site-section"
      style={{ padding: "140px 24px", position: "relative" }}
    >
      <div className="site-container" style={{ maxWidth: 1200, margin: "0 auto" }}>
        <header style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 80px" }}>
          <p
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              fontSize: 11,
              color: "#70FFDD",
              margin: "0 0 20px 0",
            }}
          >
            PREÇOS
          </p>
          <h2
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
            Simples,{" "}
            <span style={{ color: "#A0A0AB" }}>sem letras miúdas.</span>
          </h2>
          <p
            style={{
              fontSize: "clamp(16px, 1.4vw, 19px)",
              lineHeight: 1.6,
              color: "#A0A0AB",
              margin: 0,
            }}
          >
            Cobramos pelo valor real — não pela retenção forçada. Cancele quando quiser.
          </p>
        </header>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 20,
            alignItems: "stretch",
          }}
        >
          {TIERS.map((t, i) => (
            <article
              key={t.name}
              data-tier
              data-idx={i}
              style={{
                position: "relative",
                background: t.highlight
                  ? "linear-gradient(160deg, rgba(112,255,221,0.06) 0%, rgba(255,255,255,0.03) 100%)"
                  : "rgba(255,255,255,0.025)",
                border: t.highlight
                  ? "1px solid rgba(112,255,221,0.30)"
                  : "1px solid rgba(255,255,255,0.07)",
                borderRadius: 24,
                padding: "40px 32px",
                backdropFilter: "blur(20px)",
                WebkitBackdropFilter: "blur(20px)",
                boxShadow: t.highlight
                  ? "0 0 60px rgba(112,255,221,0.10), 0 0 0 1px rgba(112,255,221,0.08) inset"
                  : "none",
                display: "flex",
                flexDirection: "column",
                gap: 24,
              }}
            >
              {t.highlight && (
                <div
                  style={{
                    position: "absolute",
                    top: 20,
                    right: 20,
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.16em",
                    color: "#0A0A0E",
                    background: "#70FFDD",
                    padding: "4px 10px",
                    borderRadius: 999,
                    fontWeight: 600,
                  }}
                >
                  Mais escolhido
                </div>
              )}
              {t.badge && (
                <div
                  style={{
                    position: "absolute",
                    top: 20,
                    right: 20,
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 10,
                    textTransform: "uppercase",
                    letterSpacing: "0.16em",
                    color: "#A0A0AB",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.10)",
                    padding: "4px 10px",
                    borderRadius: 999,
                  }}
                >
                  {t.badge}
                </div>
              )}

              <div>
                <h3
                  style={{
                    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                    fontSize: 22,
                    fontWeight: 600,
                    color: "#FAFAFC",
                    margin: "0 0 12px",
                  }}
                >
                  {t.name}
                </h3>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 12 }}>
                  <span
                    style={{
                      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                      fontSize: 48,
                      lineHeight: 1,
                      letterSpacing: "-0.03em",
                      fontWeight: 700,
                      color: "#FAFAFC",
                    }}
                  >
                    {t.price}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      color: "#6B6B7B",
                      fontWeight: 500,
                    }}
                  >
                    {t.period}
                  </span>
                </div>
                <p style={{ fontSize: 14, color: "#A0A0AB", lineHeight: 1.5, margin: 0 }}>
                  {t.description}
                </p>
              </div>

              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
                {t.features.map((f) => (
                  <li
                    key={f}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      fontSize: 14,
                      color: "#A0A0AB",
                      lineHeight: 1.45,
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={t.highlight ? "#70FFDD" : "#A0A0AB"}
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ flexShrink: 0, marginTop: 3 }}
                      aria-hidden="true"
                    >
                      <path d="M5 12l5 5 9-11" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={t.href}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "14px 24px",
                  borderRadius: 999,
                  marginTop: "auto",
                  background: t.highlight ? "#70FFDD" : "rgba(255,255,255,0.05)",
                  color: t.highlight ? "#0A0A0E" : "#FAFAFC",
                  fontWeight: 600,
                  fontSize: 14,
                  textDecoration: "none",
                  border: t.highlight
                    ? "1px solid #70FFDD"
                    : "1px solid rgba(255,255,255,0.12)",
                  textAlign: "center",
                  transition: "transform 200ms ease",
                }}
              >
                {t.cta}
              </Link>
            </article>
          ))}
        </div>

        <p
          style={{
            textAlign: "center",
            fontSize: 13,
            color: "#6B6B7B",
            marginTop: 40,
            maxWidth: 600,
            margin: "40px auto 0",
            lineHeight: 1.5,
          }}
        >
          Pagamento via Stripe. Notas fiscais automaticas. Cancelamento em 1 clique.
          Garantia de 7 dias.
        </p>
      </div>
    </section>
  );
}
