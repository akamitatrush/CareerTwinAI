// Footer 3 colunas. Server component (sem JS necessario).
// Sem cursor glow, sem nada animado — espaco respiratorio + info util.

import Link from "next/link";

const COLS = [
  {
    title: "Produto",
    links: [
      { label: "Como funciona", href: "#como-funciona" },
      { label: "Preços", href: "#precos" },
      { label: "FAQ", href: "#faq" },
      { label: "Login", href: "/entrar" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { label: "Tera", href: "https://somostera.com", external: true },
      { label: "GitHub", href: "https://github.com", external: true },
      { label: "Blog", href: "#", external: false },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacidade", href: "/privacidade" },
      { label: "Termos", href: "/termos" },
      { label: "LGPD", href: "/privacidade#lgpd" },
    ],
  },
];

export default function SiteFooter() {
  return (
    <footer
      style={{
        position: "relative",
        padding: "100px 24px 48px",
        borderTop: "1px solid var(--site-border)",
        background: "linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--site-bg) 80%, transparent) 100%)",
      }}
    >
      <div
        className="site-container"
        style={{ maxWidth: 1280, margin: "0 auto" }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(220px, 1.4fr) repeat(3, 1fr)",
            gap: 48,
            marginBottom: 80,
          }}
          className="site-footer-grid"
        >
          <div>
            <Link
              href="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                color: "var(--site-fg)",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 20,
                letterSpacing: "-0.015em",
                marginBottom: 16,
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: "var(--site-accent)",
                  boxShadow: "0 0 16px var(--site-accent-glow)",
                }}
              />
              CareerTwin
            </Link>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.55,
                color: "var(--site-fg-dim)",
                margin: 0,
                maxWidth: "32ch",
              }}
            >
              Copiloto de carreira brasileiro — auditável, com fonte e sem caixa-preta.
            </p>
          </div>

          {COLS.map((col) => (
            <div key={col.title}>
              <h4
                style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  textTransform: "uppercase",
                  letterSpacing: "0.16em",
                  fontSize: 11,
                  color: "var(--site-fg-dim)",
                  fontWeight: 600,
                  margin: "0 0 20px",
                }}
              >
                {col.title}
              </h4>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 12 }}>
                {col.links.map((l) => (
                  <li key={l.label}>
                    {l.external ? (
                      <a
                        href={l.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={footerLinkStyle}
                      >
                        {l.label}
                      </a>
                    ) : (
                      <Link href={l.href} style={footerLinkStyle}>
                        {l.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 32,
            borderTop: "1px solid var(--site-border)",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <p
            style={{
              fontSize: 13,
              color: "var(--site-fg-dim)",
              margin: 0,
            }}
          >
            © {new Date().getFullYear()} CareerTwin AI. Construído em São Paulo.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              style={socialIconStyle}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.42c.57.1.78-.25.78-.55v-2c-3.2.7-3.88-1.4-3.88-1.4-.52-1.32-1.27-1.67-1.27-1.67-1.04-.7.08-.68.08-.68 1.15.08 1.75 1.18 1.75 1.18 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.25.72-1.54-2.55-.3-5.23-1.27-5.23-5.66 0-1.25.45-2.27 1.18-3.07-.12-.3-.51-1.46.11-3.05 0 0 .96-.3 3.15 1.17a10.95 10.95 0 0 1 5.74 0c2.18-1.47 3.14-1.17 3.14-1.17.62 1.59.23 2.75.11 3.05.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.35.78 1.04.78 2.1v3.12c0 .3.21.66.79.55A11.5 11.5 0 0 0 12 .5z" />
              </svg>
            </a>
            <a
              href="https://www.linkedin.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="LinkedIn"
              style={socialIconStyle}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z" />
              </svg>
            </a>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 760px) {
          .site-footer-grid {
            grid-template-columns: 1fr 1fr !important;
            gap: 32px !important;
          }
          .site-footer-grid > div:first-child {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </footer>
  );
}

const footerLinkStyle = {
  color: "var(--site-fg-muted)",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 400,
  transition: "color 180ms ease",
};

const socialIconStyle = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  background: "var(--site-card-bg)",
  border: "1px solid var(--site-border)",
  color: "var(--site-fg-muted)",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  transition: "color 180ms ease, border-color 180ms ease",
};
