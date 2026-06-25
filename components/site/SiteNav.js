"use client";

// Nav fixa premium. Transparent no topo, vira glassmorphism ao scroll.
// Critério: usar IntersectionObserver com um sentinel no topo seria mais
// performático que scroll listener, mas o overhead aqui é mínimo (passive,
// throttled implicitamente pelo browser) e a leitura do código fica mais
// óbvia pra próximos plantonistas. Mantemos scroll listener.

import { useEffect, useState } from "react";
import Link from "next/link";

export default function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    transition: "background 220ms ease, backdrop-filter 220ms ease, border-color 220ms ease",
    background: scrolled
      ? "rgba(10, 10, 14, 0.72)"
      : "transparent",
    backdropFilter: scrolled ? "saturate(140%) blur(18px)" : "none",
    WebkitBackdropFilter: scrolled ? "saturate(140%) blur(18px)" : "none",
    borderBottom: scrolled
      ? "1px solid rgba(255,255,255,0.06)"
      : "1px solid transparent",
  };

  return (
    <nav style={navStyle} aria-label="Navegação principal">
      <div
        className="site-container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "18px 24px",
          maxWidth: 1280,
          margin: "0 auto",
        }}
      >
        <Link
          href="/site"
          aria-label="CareerTwin — início"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            color: "#FAFAFC",
            textDecoration: "none",
            fontWeight: 600,
            fontSize: 18,
            letterSpacing: "-0.01em",
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "#70FFDD",
              boxShadow: "0 0 16px rgba(112,255,221,0.65)",
              flexShrink: 0,
            }}
          />
          <span>CareerTwin</span>
        </Link>

        {/* Desktop links */}
        <ul
          style={{
            display: "flex",
            alignItems: "center",
            gap: 32,
            margin: 0,
            padding: 0,
            listStyle: "none",
          }}
          className="site-nav-desktop"
        >
          <li>
            <a href="#como-funciona" style={navLinkStyle}>Como funciona</a>
          </li>
          <li>
            <a href="#precos" style={navLinkStyle}>Preços</a>
          </li>
          <li>
            <a href="#faq" style={navLinkStyle}>FAQ</a>
          </li>
        </ul>

        {/* Desktop CTAs */}
        <div
          style={{ display: "flex", alignItems: "center", gap: 12 }}
          className="site-nav-desktop"
        >
          <Link href="/entrar" className="site-btn-secondary" style={btnSecondaryFallback}>
            Entrar
          </Link>
          <Link href="/" className="site-btn-primary" style={btnPrimaryFallback}>
            Começar grátis
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          type="button"
          aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((v) => !v)}
          className="site-nav-burger"
          style={{
            display: "none",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.10)",
            borderRadius: 10,
            width: 40,
            height: 40,
            cursor: "pointer",
            color: "#FAFAFC",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {mobileOpen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 6l12 12M6 18L18 6" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          style={{
            background: "rgba(10,10,14,0.96)",
            backdropFilter: "blur(18px)",
            WebkitBackdropFilter: "blur(18px)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            padding: "12px 24px 28px",
          }}
        >
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 4 }}>
            <li><a href="#como-funciona" onClick={() => setMobileOpen(false)} style={mobileLinkStyle}>Como funciona</a></li>
            <li><a href="#precos" onClick={() => setMobileOpen(false)} style={mobileLinkStyle}>Preços</a></li>
            <li><a href="#faq" onClick={() => setMobileOpen(false)} style={mobileLinkStyle}>FAQ</a></li>
          </ul>
          <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
            <Link href="/entrar" className="site-btn-secondary" style={{ ...btnSecondaryFallback, textAlign: "center" }}>Entrar</Link>
            <Link href="/" className="site-btn-primary" style={{ ...btnPrimaryFallback, textAlign: "center" }}>Começar grátis</Link>
          </div>
        </div>
      )}

      {/* Media queries inline pra mobile/desktop sem precisar editar globals.css */}
      <style>{`
        @media (max-width: 860px) {
          .site-nav-desktop { display: none !important; }
          .site-nav-burger { display: inline-flex !important; }
        }
      `}</style>
    </nav>
  );
}

const navLinkStyle = {
  color: "#A0A0AB",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 500,
  transition: "color 180ms ease",
};

const mobileLinkStyle = {
  display: "block",
  padding: "14px 4px",
  color: "#FAFAFC",
  textDecoration: "none",
  fontSize: 16,
  fontWeight: 500,
  borderBottom: "1px solid rgba(255,255,255,0.05)",
};

// Fallbacks pro caso de globals.css ainda não ter as classes site-btn-*.
// Quando Legolas terminar, as classes terão prioridade visual; o style inline
// segue como rede de segurança visual mínima — ainda renderiza um botão
// reconhecível em vez de texto solto.
const btnPrimaryFallback = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 18px",
  borderRadius: 999,
  background: "#70FFDD",
  color: "#0A0A0E",
  fontWeight: 600,
  fontSize: 14,
  textDecoration: "none",
  border: "1px solid #70FFDD",
  whiteSpace: "nowrap",
};

const btnSecondaryFallback = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 18px",
  borderRadius: 999,
  background: "rgba(255,255,255,0.04)",
  color: "#FAFAFC",
  fontWeight: 500,
  fontSize: 14,
  textDecoration: "none",
  border: "1px solid rgba(255,255,255,0.10)",
  whiteSpace: "nowrap",
};
