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
    title: "Comece sua jornada de carreira hoje",
    desc: "Marque sua primeira microação e comece a evoluir.",
    cta: "Ver gaps",
    href: "/gaps",
  },
};

export default function DashboardHighlightBanner({ variant = "refresh", count = 0 }) {
  const v = VARIANTS[variant] || VARIANTS.refresh;
  const title = v.title.replace("{count}", String(count));
  return (
    <section className="ct-highlight-banner" aria-label="Destaque">
      <div className="ct-highlight-banner-icon" aria-hidden="true">
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
