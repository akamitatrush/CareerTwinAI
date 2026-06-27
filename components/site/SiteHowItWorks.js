// 3 steps gigantes. Cloudwalk pattern: numero enorme (60+) à esquerda,
// conteudo à direita, separadores fininhos entre eles.
// Sticky number trick (browser feature: position: sticky relativo a parent).
// Mas pra evitar complexidade visual: layout linear, com lines verticais
// conectando os steps (visual de trajetoria continua).
//
// Server Component apos audit Gimli v3: fade-up via CSS @keyframes
// (.site-fade-up em globals.css), sem IntersectionObserver.

const STEPS = [
  {
    n: "01",
    title: "Cole seu CV + cargo-alvo",
    sub: "~30 segundos",
    desc: "Texto puro do CV (até PDF se preferir) e o cargo que você quer atacar. Nada além disso pra começar.",
    icon: (
      <svg viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="12" y="8" width="32" height="40" rx="4" />
        <path d="M18 18h20M18 24h20M18 30h14M18 36h10" />
      </svg>
    ),
  },
  {
    n: "02",
    title: "Receba diagnóstico auditável",
    sub: "~10 segundos via streaming",
    desc: "Score composto + sub-scores. Gaps priorizados com microação pra cada um. Vagas reais (Brasil) com aderência calculada e o porquê.",
    icon: (
      <svg viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="28" cy="28" r="18" />
        <path d="M28 16v12l8 5" />
        <circle cx="28" cy="28" r="2.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    n: "03",
    title: "Evolua semana a semana",
    sub: "Iteração contínua",
    desc: "Acompanhe seu funil de candidaturas, registre conquistas, recalcule o score. CareerTwin lembra do contexto — você só foca em executar.",
    icon: (
      <svg viewBox="0 0 56 56" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 44l12-12 8 6 20-22" />
        <path d="M36 16h12v12" />
      </svg>
    ),
  },
];

export default function SiteHowItWorks() {
  return (
    <section
      id="como-funciona"
      className="site-section"
      style={{
        padding: "140px 24px",
        position: "relative",
        background:
          "linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--site-fg) 2%, transparent) 50%, transparent 100%)",
      }}
    >
      <div
        className="site-container"
        style={{ maxWidth: 1200, margin: "0 auto" }}
      >
        <header style={{ maxWidth: 720, marginBottom: 96 }}>
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
            COMO FUNCIONA
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
            Três passos.{" "}
            <span style={{ color: "var(--site-fg-muted)" }}>Sem ginástica mental.</span>
          </h2>
        </header>

        <div
          style={{
            display: "grid",
            gap: 0,
          }}
        >
          {STEPS.map((step, i) => (
            <div
              key={step.n}
              data-step
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(120px, 240px) 1fr minmax(80px, 160px)",
                gap: 48,
                alignItems: "start",
                padding: "56px 0",
                borderTop: i === 0 ? "1px solid var(--site-border)" : "none",
                borderBottom: "1px solid var(--site-border)",
                animationDelay: `${i * 120}ms`,
              }}
              className="site-how-step site-fade-up"
            >
              <div
                style={{
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                  fontSize: "clamp(64px, 10vw, 140px)",
                  lineHeight: 0.9,
                  letterSpacing: "-0.04em",
                  fontWeight: 700,
                  color: "transparent",
                  WebkitTextStroke: "1.5px var(--site-border-strong)",
                }}
              >
                {step.n}
              </div>

              <div>
                <p
                  style={{
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    fontSize: 11,
                    color: "var(--site-fg-dim)",
                    margin: "0 0 14px",
                  }}
                >
                  {step.sub}
                </p>
                <h3
                  style={{
                    fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                    fontSize: "clamp(26px, 3vw, 40px)",
                    lineHeight: 1.15,
                    letterSpacing: "-0.02em",
                    fontWeight: 600,
                    color: "var(--site-fg)",
                    margin: "0 0 16px",
                    maxWidth: "20ch",
                  }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    fontSize: "clamp(15px, 1.3vw, 18px)",
                    lineHeight: 1.6,
                    color: "var(--site-fg-muted)",
                    margin: 0,
                    maxWidth: "52ch",
                  }}
                >
                  {step.desc}
                </p>
              </div>

              <div
                aria-hidden="true"
                style={{
                  color: "var(--site-fg-dim)",
                  justifySelf: "end",
                  width: 56,
                  height: 56,
                }}
              >
                {step.icon}
              </div>
            </div>
          ))}
        </div>

        <style>{`
          @media (max-width: 760px) {
            .site-how-step {
              grid-template-columns: 1fr !important;
              gap: 16px !important;
              padding: 40px 0 !important;
            }
            .site-how-step > div:last-child {
              display: none;
            }
          }
        `}</style>
      </div>
    </section>
  );
}
