"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import NotificationsBell from "@/components/NotificationsBell";
import CopilotWidget from "@/components/CopilotWidget";
import Icon from "@/components/Icon";

// NAV usa nomes do registro centralizado em components/Icon.js.
// Cada glyph "nav-*" vive la, viewBox 0 0 24 24, stroke=currentColor.
// Mudou de iconPath (string) -> iconName (chave). Garante consistencia
// visual (mesmos stroke-widths/linecaps via Icon).
const NAV = [
  { href: "/dashboard", label: "Dashboard", iconName: "nav-home" },
  { href: "/gaps", label: "Análise de gaps", iconName: "nav-chart" },
  { href: "/oportunidades", label: "Radar de vagas", iconName: "nav-radar" },
  { href: "/concursos", label: "Concursos", iconName: "nav-star" },
  { href: "/estagios", label: "Estágios", iconName: "nav-briefcase" },
  { href: "/funil", label: "Funil de busca", iconName: "nav-funnel" },
  {
    // Roadmap visual de carreira (feature #5 do STRATEGY_ROADMAP, MVP
    // deterministico). Fica antes do /plano porque o "plano de carreira"
    // e a visao macro (12-18 meses), e o /plano e tactico (proximas semanas).
    href: "/carreira",
    label: "Plano de carreira",
    iconName: "nav-trend-up",
  },
  { href: "/plano", label: "Plano", iconName: "nav-checklist" },
  { href: "/transparencia", label: "Transparência", iconName: "nav-shield" },
  {
    // Modulo de autoconhecimento (3 mini-assessments: DISC-lite, Valores,
    // Ikigai). Item antes de "CVs adaptados" pra agrupar com identidade/perfil.
    href: "/autoconhecimento",
    label: "Autoconhecimento",
    iconName: "nav-user",
  },
  { href: "/cvs-adaptados", label: "CVs adaptados", iconName: "nav-doc" },
  { href: "/candidaturas", label: "Candidaturas", iconName: "nav-folder" },
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
        /* currentColor + style.color = var(--on-primary). Atributos SVG
           (stroke="...") nao processam var() diretamente; currentColor
           herda do CSS, e style.color resolve a var por tema.
           Light/dark: #FFFFFF sobre indigo. Noir: #000000 sobre o gradient
           branco-cinza (antes era #fff hardcoded — ficava invisivel). */
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: "var(--on-primary)" }}
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

// NavIcon wrapper: tamanho 19px (entre 16 e 20 — vinha do legado pra
// caber no spacing da sidebar; mantido por consistencia visual). Stroke
// 1.5 e o default canonico de Icon (era 1.8 no legado; visualmente
// indistinguivel em 19px de display, e ganhamos consistencia com o resto).
function NavIcon({ name }) {
  return <Icon name={name} size={19} />;
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
                  <NavIcon name={item.iconName} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="appshell-lgpd-card">
            <div className="appshell-lgpd-title">
              {/* 13px nao bate o scale 12/16/20/24 — exceto inline com texto
                  uppercase de fonte 10-11px, onde 13 era proposital. Manter
                  13 via prop. Stroke 2 (forte) reforca o "selo" LGPD. */}
              <Icon name="shield" size={13} stroke={2} />
              SEUS DADOS, PROTEGIDOS
            </div>
            <p className="appshell-lgpd-text">
              Criptografados e nunca compartilhados sem sua permissão. Conforme
              a LGPD.
            </p>
          </div>

          <div className="appshell-user">
            {/* Link cobre avatar+info; bell fica fora pra nao "engolir" clique
                no sino. Wave 10 fix — antes era <div> nao-clicavel, sem item
                "Conta" na nav. Agora vira atalho pra /conta com a11y label. */}
            <Link
              href="/conta"
              className="appshell-user-link"
              aria-label="Ver minha conta"
            >
              {user?.image ? (
                <img
                  className="appshell-avatar"
                  src={user.image}
                  alt=""
                  width={36}
                  height={36}
                  aria-hidden="true"
                />
              ) : (
                <div className="appshell-avatar" aria-hidden="true">
                  {initial}
                </div>
              )}
              <div className="appshell-user-info">
                <div className="appshell-user-name">{userName}</div>
                <div className="appshell-user-role" title={targetRole}>
                  {targetRole}
                </div>
              </div>
            </Link>
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
                    <NavIcon name={item.iconName} />
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
