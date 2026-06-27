// Social proof honesto. Nao fingimos volume de clientes que nao existe.
// Mostramos:
//   - origem (time da Tera)
//   - stats reais e auditaveis (tests, rotas, RAG, LGPD)
//   - quote generica honesta (sem inventar testimonial)
//   - stack tecnologico (credibilidade de engenharia)
//
// Server Component apos audit Gimli v3: fade-up via CSS @keyframes
// (.site-fade-up em globals.css), sem IntersectionObserver.

const STATS = [
  { value: "1101", label: "testes automatizados" },
  { value: "50", label: "rotas API" },
  { value: "159", label: "chunks RAG curados" },
  { value: "93.9%", label: "Recall@3" },
];

const STACK = [
  { name: "Anthropic Claude", icon: "C" },
  { name: "Voyage AI", icon: "V" },
  { name: "Vercel", icon: "▲" },
  { name: "Neon", icon: "◐" },
  { name: "Upstash", icon: "U" },
  { name: "Prisma", icon: "P" },
];

export default function SiteSocialProof() {
  return (
    <section
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
        <div
          data-proof
          data-idx="0"
          className="site-fade-up"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            justifyContent: "center",
            marginBottom: 56,
            flexWrap: "wrap",
            animationDelay: "0ms",
          }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              fontSize: 11,
              color: "var(--site-fg-dim)",
            }}
          >
            Construído pelo time da
          </span>
          <span
            style={{
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontWeight: 700,
              fontSize: 28,
              color: "var(--site-fg)",
              letterSpacing: "-0.02em",
            }}
          >
            tera
          </span>
        </div>

        {/* Stats grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 32,
            padding: "48px 0",
            borderTop: "1px solid var(--site-border)",
            borderBottom: "1px solid var(--site-border)",
            marginBottom: 80,
          }}
        >
          {STATS.map((s, i) => (
            <div
              key={s.label}
              data-proof
              data-idx={i + 1}
              className="site-fade-up"
              style={{ textAlign: "center", animationDelay: `${(i + 1) * 70}ms` }}
            >
              <div
                style={{
                  fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                  fontSize: "clamp(40px, 5vw, 64px)",
                  lineHeight: 1,
                  letterSpacing: "-0.03em",
                  fontWeight: 700,
                  color: "var(--site-fg)",
                  marginBottom: 12,
                }}
              >
                {s.value}
              </div>
              <div
                style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  color: "var(--site-fg-dim)",
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Quote */}
        <blockquote
          data-proof
          data-idx="5"
          className="site-fade-up"
          style={{
            maxWidth: 880,
            margin: "0 auto 80px",
            textAlign: "center",
            padding: 0,
            animationDelay: "350ms",
          }}
        >
          <p
            style={{
              fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
              fontSize: "clamp(22px, 2.6vw, 36px)",
              lineHeight: 1.35,
              letterSpacing: "-0.015em",
              fontWeight: 400,
              color: "var(--site-fg)",
              margin: "0 0 24px",
            }}
          >
            <span style={{ color: "var(--site-accent)" }}>“</span>
            Construímos o CareerTwin como construiríamos qualquer produto sério:
            código auditável, números reproduzíveis, dado tratado com respeito.
            <span style={{ color: "var(--site-accent)" }}>”</span>
          </p>
          <footer
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 12,
              textTransform: "uppercase",
              letterSpacing: "0.16em",
              color: "var(--site-fg-dim)",
            }}
          >
            — Time CareerTwin
          </footer>
        </blockquote>

        {/* Stack logos */}
        <div data-proof data-idx="6" className="site-fade-up" style={{ animationDelay: "420ms" }}>
          <p
            style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              fontSize: 11,
              color: "var(--site-fg-dim)",
              textAlign: "center",
              margin: "0 0 28px",
            }}
          >
            Stack de engenharia
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            {STACK.map((s) => (
              <div
                key={s.name}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 18px",
                  background: "var(--site-card-bg)",
                  border: "1px solid var(--site-border)",
                  borderRadius: 999,
                  color: "var(--site-fg-muted)",
                  fontSize: 13,
                  fontWeight: 500,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: "var(--site-accent-glow)",
                    color: "var(--site-accent)",
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {s.icon}
                </span>
                {s.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
