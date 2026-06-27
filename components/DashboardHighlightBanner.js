"use client";

// Banner sutil acima do score ring no dashboard. Mostra UMA mensagem
// contextual ao estado do user: ex. "voce esta a 3 microacoes do nivel
// 80+", "nova vaga combina 92% com seu perfil", "que tal atualizar seu
// diagnostico essa semana?". MVP deterministico (sem LLM); evoluir
// depois pra recomendacao contextual via LLM.

const VARIANTS = {
  refresh: {
    icon: "↻",
    title: "Que tal atualizar seu diagnóstico?",
    desc: "Faz mais de 7 dias desde sua última análise. Veja o que mudou.",
    cta: "Atualizar",
    href: "/dashboard?refresh=1",
  },
  microacao: {
    icon: "✓",
    title: "Você completou {count} microação(ões) recentemente",
    desc: "Recalcule seu Career Health pra ver o impacto real no seu score.",
    cta: "Recalcular",
    href: "#refresh",
  },
  noStreak: {
    icon: "✦",
    title: "Comece seu plano de carreira hoje",
    desc: "Marque sua primeira microação e comece a evoluir.",
    cta: "Ver gaps",
    href: "/gaps",
  },
};

export default function DashboardHighlightBanner({ variant = "refresh", count = 0 }) {
  const v = VARIANTS[variant] || VARIANTS.refresh;
  const title = v.title.replace("{count}", String(count));
  return (
    <section
      className="ct-highlight-banner app-glass"
      aria-label="Destaque"
      style={{
        // Refresh visual: banner do dashboard ganha glassmorphism premium +
        // borda cyan-glow + sombra de profundidade. Mantemos a classe original
        // ct-highlight-banner pro layout (flex + padding + responsive).
        background: "var(--app-glass-bg)",
        backdropFilter: "blur(var(--app-glass-blur))",
        WebkitBackdropFilter: "blur(var(--app-glass-blur))",
        border: "1px solid var(--accent-cyan-glow)",
        boxShadow: "var(--shadow-md), 0 0 24px var(--accent-cyan-glow)",
      }}
    >
      <div
        className="ct-highlight-banner-icon"
        aria-hidden="true"
        style={{
          // Refresh visual: icone recebe glow cyan pra puxar olhar.
          filter: "drop-shadow(0 0 8px var(--accent-cyan-glow))",
        }}
      >
        <span style={{ fontSize: 22, lineHeight: 1, fontWeight: 700 }}>{v.icon}</span>
      </div>
      <div className="ct-highlight-banner-content">
        <h3 className="ct-highlight-banner-title">{title}</h3>
        <p className="ct-highlight-banner-desc">{v.desc}</p>
      </div>
      <a className="ct-highlight-banner-cta" href={v.href}>
        {v.cta}
      </a>
    </section>
  );
}
