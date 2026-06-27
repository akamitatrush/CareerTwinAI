// FAQ usando <details>/<summary> semantico. SEO-friendly, sem JS necessario,
// acessivel por teclado out-of-the-box.
// Style: chevron rotaciona via CSS no [open]; padding generoso, divisores
// limpos entre items.
//
// Server Component apos audit Gimli v3: fade-up agora via CSS @keyframes
// (.site-fade-up em globals.css). Zero JS pra animacao de entrada.

const FAQ = [
  {
    q: "O que diferencia do Jobscan/Teal/outras ferramentas gringas?",
    a: "Mercado brasileiro como protagonista. RAG curado com 159 chunks de conteúdo BR, vagas com aderência calculada e contexto local (LGPD, CLT, mercado de tech BR). Jobscan otimiza CV pra ATS gringo — a gente otimiza sua carreira no Brasil.",
  },
  {
    q: "Por que pagar se ChatGPT é grátis?",
    a: "ChatGPT te dá uma opinião genérica sem fonte. CareerTwin te dá um diagnóstico com fórmula auditável, microação ligada a fonte real e funil persistente. Você sabe de onde veio cada número e pode recalcular semana a semana.",
  },
  {
    q: "Meus dados ficam seguros?",
    a: "LGPD by-design. Texto do CV tem TTL de 90 dias. IP nunca em raw (hash + salt). 21 ações sensíveis auditadas. Você exporta tudo ou deleta sua conta em 1 clique. Hospedagem em Neon (UE), criptografia em trânsito e em repouso.",
  },
  {
    q: "Funciona pra todos os cargos?",
    a: "Foco hoje em tech (dev, dados, produto, design, UX). Outros cargos rodam, mas com cobertura RAG menor. Estamos expandindo trimestralmente — manda feedback se sua área não estiver bem coberta.",
  },
  {
    q: "Cancelo quando quiser?",
    a: "Sim. Cancelamento em 1 clique pelo painel, sem ligação, sem retenção forçada. Garantia de 7 dias com reembolso integral via Stripe.",
  },
  {
    q: "Posso testar sem cadastro?",
    a: "Pode. O modo experimentar gera diagnóstico completo em ~10s sem login. CV fica em memória, nada é persistido. Quando quiser histórico ou funil, você cria conta.",
  },
  {
    q: "É só pra Brasil?",
    a: "Por enquanto sim. A curadoria do RAG é BR, as vagas que indexamos são BR, o tom de voz é BR. Em 2026 avaliamos LatAm. Internacional não é roadmap próximo.",
  },
  {
    q: "Tem versão B2B/HR?",
    a: "Team está em desenvolvimento (analytics consolidado, multi-seat, white-label). Entre na lista de espera pelo botão na seção de preços — chamamos quando abrir.",
  },
];

export default function SiteFaq() {
  return (
    <section
      id="faq"
      className="site-section"
      style={{ padding: "140px 24px", position: "relative" }}
    >
      <div className="site-container" style={{ maxWidth: 920, margin: "0 auto" }}>
        <header style={{ marginBottom: 64 }}>
          <p
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              fontSize: 11,
              color: "var(--site-accent-magenta)",
              margin: "0 0 20px 0",
            }}
          >
            FAQ
          </p>
          <h2
            style={{
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontSize: "clamp(36px, 5vw, 64px)",
              lineHeight: 1.05,
              letterSpacing: "-0.025em",
              fontWeight: 700,
              color: "var(--site-fg)",
              margin: "0 0 24px",
            }}
          >
            Perguntas que{" "}
            <span style={{ color: "var(--site-fg-muted)" }}>todo mundo faz.</span>
          </h2>
        </header>

        <div style={{ borderTop: "1px solid var(--site-border)" }}>
          {FAQ.map((item, i) => (
            <details
              key={item.q}
              data-faq
              data-idx={i}
              className="site-faq-item site-fade-up"
              style={{
                borderBottom: "1px solid var(--site-border)",
                padding: "24px 0",
                animationDelay: `${i * 50}ms`,
              }}
            >
              <summary
                style={{
                  cursor: "pointer",
                  listStyle: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                  fontSize: "clamp(17px, 1.6vw, 20px)",
                  lineHeight: 1.35,
                  fontWeight: 500,
                  letterSpacing: "-0.01em",
                  color: "var(--site-fg)",
                  padding: "8px 0",
                }}
              >
                <span>{item.q}</span>
                <span
                  aria-hidden="true"
                  className="site-faq-icon"
                  style={{
                    flexShrink: 0,
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    border: "1px solid var(--site-border-strong)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--site-fg-muted)",
                    transition: "transform 250ms ease, border-color 250ms ease, color 250ms ease",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </span>
              </summary>
              <div
                style={{
                  paddingTop: 16,
                  paddingRight: 48,
                  fontSize: 16,
                  lineHeight: 1.65,
                  color: "var(--site-fg-muted)",
                }}
              >
                {item.a}
              </div>
            </details>
          ))}
        </div>

        <style>{`
          .site-faq-item summary::-webkit-details-marker { display: none; }
          .site-faq-item .site-faq-icon {
            transition: transform 220ms ease, border-color 220ms ease, color 220ms ease;
          }
          .site-faq-item[open] .site-faq-icon {
            transform: rotate(180deg);
            border-color: var(--site-accent);
            color: var(--site-accent);
          }
          .site-faq-item summary:hover .site-faq-icon {
            border-color: var(--site-fg);
            color: var(--site-fg);
          }
          @media (prefers-reduced-motion: reduce) {
            .site-faq-item .site-faq-icon {
              transition: none !important;
            }
          }
        `}</style>
      </div>
    </section>
  );
}
