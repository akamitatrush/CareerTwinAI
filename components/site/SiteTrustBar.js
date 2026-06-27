// TrustBar — fila discreta de "selos" de confianca entre Hero e Features.
// Pilula com microicone SVG + label curta. Glass sutil em noir, border-soft
// em light/dark. Fade-up stagger via CSS @keyframes (.site-fade-up).
// Tudo via tokens var(--site-*); zero hex hardcoded.
//
// Mobile: vira scroll horizontal com snap. Desktop: grid auto-fit.
// Server Component apos audit Gimli v3 (zero JS de animacao).

const CHIPS = [
  {
    label: "LGPD by-design",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3l8 3v6c0 4.5-3.4 8.4-8 9-4.6-.6-8-4.5-8-9V6l8-3z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: "Score 100% auditável",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M3 17l5-5 4 4 8-8" />
        <path d="M14 8h6v6" />
      </svg>
    ),
  },
  {
    label: "Sem caixa-preta",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    label: "Vagas reais (Gupy/Vagas.com)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="7" width="18" height="13" rx="2" />
        <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
        <path d="M3 12h18" />
      </svg>
    ),
  },
  {
    label: "Open source-ready",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 18l6-6-6-6" />
        <path d="M8 6l-6 6 6 6" />
        <path d="M14 4l-4 16" />
      </svg>
    ),
  },
  {
    label: "Brasil-first",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
      </svg>
    ),
  },
];

export default function SiteTrustBar() {
  return (
    <section
      aria-label="Sinais de confianca"
      className="site-section site-trust-bar"
      style={{
        paddingTop: 48,
        paddingBottom: 48,
        position: "relative",
        borderTop: "1px solid var(--site-border)",
        borderBottom: "1px solid var(--site-border)",
      }}
    >
      <div
        className="site-container site-trust-grid"
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "0 24px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          alignItems: "stretch",
        }}
      >
        {CHIPS.map((c, i) => (
          <div
            key={c.label}
            data-chip
            data-idx={i}
            className="site-fade-up"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              borderRadius: 999,
              background: "var(--site-card-bg)",
              border: "1px solid var(--site-border)",
              color: "var(--site-fg-muted)",
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 12,
              letterSpacing: "0.02em",
              backdropFilter: "blur(var(--site-glass-blur))",
              WebkitBackdropFilter: "blur(var(--site-glass-blur))",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              animationDelay: `${i * 60}ms`,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "inline-flex",
                width: 16,
                height: 16,
                color: "var(--site-accent)",
                flexShrink: 0,
              }}
            >
              {c.icon}
            </span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{c.label}</span>
          </div>
        ))}
      </div>

      <style>{`
        @media (max-width: 720px) {
          .site-trust-grid {
            display: flex !important;
            overflow-x: auto;
            scroll-snap-type: x mandatory;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 8px;
          }
          .site-trust-grid > [data-chip] {
            scroll-snap-align: start;
            flex: 0 0 auto;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .site-trust-bar [data-chip] {
            opacity: 1 !important;
            transform: none !important;
            transition: none !important;
            animation: none !important;
          }
        }
      `}</style>
    </section>
  );
}
