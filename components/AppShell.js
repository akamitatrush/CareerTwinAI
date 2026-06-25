"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import NotificationsBell from "@/components/NotificationsBell";
import CopilotWidget from "@/components/CopilotWidget";

const NAV = [
  {
    href: "/dashboard",
    label: "Dashboard",
    iconPath: "M3 12l9-9 9 9M5 10v10h14V10",
  },
  {
    href: "/gaps",
    label: "Análise de gaps",
    iconPath: "M3 3l3 12 4-8 4 6 7-13",
  },
  {
    href: "/oportunidades",
    label: "Radar de vagas",
    iconPath: "M21 21l-6-6M10 17a7 7 0 110-14 7 7 0 010 14z",
  },
  {
    href: "/concursos",
    label: "Concursos",
    iconPath: "M12 2l3 7h7l-5.5 4.5 2 7.5L12 17l-6.5 4 2-7.5L2 9h7z",
  },
  {
    href: "/estagios",
    label: "Estágios",
    iconPath: "M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2M3 7h18l-1 13H4z",
  },
  {
    href: "/funil",
    label: "Funil de busca",
    iconPath: "M3 5h18l-7 9v6l-4-2v-4z",
  },
  {
    // Roadmap visual de carreira (feature #5 do STRATEGY_ROADMAP, MVP
    // deterministico). Fica antes do /plano porque o "plano de carreira"
    // e a visao macro (12-18 meses), e o /plano e tactico (proximas semanas).
    href: "/carreira",
    label: "Plano de carreira",
    iconPath: "M3 17l6-6 4 4 8-8M14 7h7v7",
  },
  {
    href: "/plano",
    label: "Plano",
    iconPath: "M9 11l3 3 8-8M21 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11",
  },
  {
    href: "/transparencia",
    label: "Transparência",
    iconPath: "M12 2l8 4v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6z",
  },
  {
    // Modulo de autoconhecimento (3 mini-assessments: DISC-lite, Valores,
    // Ikigai). Item antes de "CVs adaptados" pra agrupar com identidade/perfil.
    href: "/autoconhecimento",
    label: "Autoconhecimento",
    iconPath: "M12 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zm0 2c-3 0-9 1.5-9 4.5V21h18v-2.5c0-3-6-4.5-9-4.5z",
  },
  {
    href: "/cvs-adaptados",
    label: "CVs adaptados",
    iconPath: "M14 3v5h5M14 3H6v18h12V8z",
  },
  {
    href: "/candidaturas",
    label: "Candidaturas",
    iconPath: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z",
  },
];

// Logo: figura de gente + check (do mock, linhas 32-33).
function BrandMark({ size = 34, radius = 10 }) {
  const inner = Math.round(size * 0.59);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: "linear-gradient(150deg, var(--primary-light), var(--primary-deep))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 6px 16px -4px rgba(52,53,126,.45), inset 0 1px 0 0 rgba(255,255,255,0.18)",
        flex: "none",
      }}
      aria-hidden="true"
    >
      <svg
        width={inner}
        height={inner}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 19c.6-3 2.9-4.6 5.5-4.6" />
        <path d="M14.5 13.5l2 2 4-4.5" />
      </svg>
    </div>
  );
}

function getInitial(name) {
  if (!name || typeof name !== "string") return "?";
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed.charAt(0).toUpperCase();
}

function NavIcon({ d }) {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}

function isActive(pathname, href) {
  if (!pathname) return false;
  if (pathname === href) return true;
  // sub-rotas (ex.: /candidaturas/123) ativam o item /candidaturas
  return pathname.startsWith(href + "/");
}

export default function AppShell({ children, user }) {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setMounted(true);
    const mq = window.matchMedia("(max-width: 880px)");
    const update = () => setIsMobile(mq.matches);
    update();
    // Safari < 14 usa addListener; padrão moderno é addEventListener.
    if (mq.addEventListener) {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  const userName = user?.name || "Usuário";
  const targetRole = user?.targetRole || "Defina seu cargo-alvo";
  const initial = getInitial(userName);

  // SSR / pré-mount: renderizamos o layout desktop como padrão.
  // O mock usa media query do JS pra escolher entre sidebar/header. Antes do
  // mount, não temos viewport — escolhemos desktop como default porque é o
  // estado mais comum e o mais "completo" (esconder sidebar < piorar mobile
  // que vai re-renderizar em <16ms). Sem flash visual em desktop; em mobile,
  // re-render imediato no primeiro effect tick.
  const showMobile = mounted && isMobile;

  return (
    <div className="appshell">
      {/* Skip link: invisivel ate receber focus por teclado (Tab).
          Permite pular sidebar/header nav (WCAG 2.4.1 Bypass Blocks).
          Aponta pra #main-content que cada <main> de tela define. */}
      <a href="#main-content" className="ct-skip-link">
        Pular para o conteúdo principal
      </a>
      {!showMobile && (
        <aside className="appshell-sidebar" aria-label="Navegação principal">
          <div className="appshell-brand">
            <BrandMark size={38} radius={11} />
            <div>
              <div className="appshell-brand-name">CareerTwin</div>
              <div className="appshell-brand-tag">SEU GÊMEO DE CARREIRA</div>
            </div>
          </div>

          <nav className="appshell-nav">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`appshell-nav-item${active ? " active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <NavIcon d={item.iconPath} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="appshell-lgpd-card">
            <div className="appshell-lgpd-title">
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 2l8 4v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6z" />
              </svg>
              SEUS DADOS, PROTEGIDOS
            </div>
            <p className="appshell-lgpd-text">
              Criptografados e nunca compartilhados sem sua permissão. Conforme
              a LGPD.
            </p>
          </div>

          <div className="appshell-user">
            <div className="appshell-avatar" aria-hidden="true">
              {initial}
            </div>
            <div className="appshell-user-info">
              <div className="appshell-user-name">{userName}</div>
              <div className="appshell-user-role" title={targetRole}>
                {targetRole}
              </div>
            </div>
            <NotificationsBell />
          </div>
        </aside>
      )}

      <div className="appshell-main">
        {showMobile && (
          <header className="appshell-mobile-header" aria-label="Navegação principal">
            <div className="appshell-mobile-top">
              <div className="appshell-mobile-brand">
                <BrandMark size={30} radius={9} />
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    letterSpacing: "-.3px",
                    color: "var(--text)",
                  }}
                >
                  CareerTwin
                </span>
              </div>
              <div className="appshell-mobile-actions">
                <NotificationsBell compact />
                <div
                  className="appshell-avatar"
                  style={{ width: 30, height: 30, fontSize: 12 }}
                  aria-hidden="true"
                  title={userName}
                >
                  {initial}
                </div>
              </div>
            </div>
            <nav className="appshell-mobile-nav">
              {NAV.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`appshell-mobile-nav-item${active ? " active" : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    <NavIcon d={item.iconPath} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </header>
        )}

        {children}
      </div>

      {/* Career Copilot — widget flutuante sempre visivel pra users logados.
          Renderizado aqui (no AppShell), entao so aparece dentro do (app)
          group, que e auth-gated no layout.js. Public pages (/, /entrar)
          nao usam AppShell, logo nao mostram o copilot. */}
      <CopilotWidget user={user} />
    </div>
  );
}
