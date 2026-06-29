import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  analyzeBottleneck,
  aggregateLastNWeeks,
  startOfWeekUTC,
} from "@/lib/funnel";
import Icon from "@/components/Icon";
import FunnelForm from "./FunnelForm";
import FunnelChart from "./FunnelChart";

// Render dinamico: auth() (cookies) + Prisma. Sem cache estatico.
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Funil de busca — CareerTwin AI",
  description:
    "Auto-reporte seus números semanais e identifique em qual estágio do funil sua busca está parando.",
};

// Formata DateTime do DB pra label PT-BR "23 jun" (compacto pra UI tabela/chart).
function formatWeekLabel(d) {
  if (!d) return "";
  const date = d instanceof Date ? d : new Date(d);
  const day = date.getUTCDate();
  const months = [
    "jan", "fev", "mar", "abr", "mai", "jun",
    "jul", "ago", "set", "out", "nov", "dez",
  ];
  return `${day} ${months[date.getUTCMonth()]}`;
}

export default async function FunilPage() {
  // Defense-in-depth: middleware ja gateia, mas re-checamos aqui.
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");

  // Le ultimas 12 entries — 3 meses de historico. IDOR-safe: where escopado
  // por userId da sessao, nunca do request.
  const entries = await prisma.funnelEntry.findMany({
    where: { userId: session.user.id },
    orderBy: { weekStart: "desc" },
    take: 12,
  });

  // Identifica entry da semana corrente (se existe) — o form usa pra pre-popular.
  // weekStart canonical permite findFirst com igualdade exata.
  const currentWeekStart = startOfWeekUTC(new Date());
  const currentWeekEntry =
    entries.find(
      (e) => new Date(e.weekStart).getTime() === currentWeekStart.getTime()
    ) || null;

  // Agrega 4 semanas mais recentes e analisa bottleneck (deterministico).
  const last4 = entries.slice(0, 4);
  const aggregated = aggregateLastNWeeks(last4, 4);
  const analysis = analyzeBottleneck(aggregated);

  const hasEntries = entries.length > 0;

  return (
    <main id="main-content" className="app-container site-section-mesh">
      <header className="ct-page-header">
        <div className="ct-page-header-icon" aria-hidden="true">
          <Icon name="nav-funnel" size={22} stroke={2} />
        </div>
        <div className="ct-page-header-content">
          <div className="ct-page-header-eyebrow">MÉTRICAS - FUNIL DE BUSCA</div>
          <h1 className="ct-page-header-title">
            Onde sua busca está parando?
          </h1>
          <p className="ct-page-header-sub">
            Anote semanalmente seus números e a gente identifica em qual estágio
            do funil seu CV está sendo barrado.
          </p>
        </div>
      </header>

      {/* Form sempre visivel — semana corrente, edita ou cria. */}
      <FunnelForm initial={currentWeekEntry} weekLabel={formatWeekLabel(currentWeekStart)} />

      {!hasEntries ? (
        <div className="ct-empty-state-v2" style={{ marginTop: 24 }}>
          <div className="ct-empty-state-v2-icon" aria-hidden="true">
            <Icon name="nav-funnel" size={30} stroke={2} />
          </div>
          <div className="ct-empty-state-v2-title">
            Comece registrando esta semana
          </div>
          <p className="ct-empty-state-v2-desc">
            Preencha o formulário acima com os números desta semana. Em ~4
            semanas a gente vai conseguir te dizer qual estágio do funil
            está segurando você.
          </p>
        </div>
      ) : (
        <>
          {/* Analise de bottleneck — cor varia conforme severity. */}
          <BottleneckBanner analysis={analysis} aggregated={aggregated} />

          {/* Chart visual do funil agregado (ultimas 4 semanas). */}
          <FunnelChart aggregated={aggregated} analysis={analysis} />

          {/* Tabela historico das ultimas 12 semanas. */}
          <HistoryTable entries={entries} />
        </>
      )}
    </main>
  );
}

// Banner com a analise de bottleneck. Verde se saudavel, amarelo/laranja se
// ha gargalo. Usa estilo inline pra evitar criar classe nova em globals.css.
function BottleneckBanner({ analysis, aggregated }) {
  if (!analysis) return null;
  // Cores via inline pra preservar a regra "nao tocar em globals.css".
  // Mapeamos severity -> tom de border-left + icone.
  // Accent unificado: em noir vira lime, em dark vira cyan — coerente com tema.
  const isHealthy = analysis.stage === "saudavel";
  const borderColor = isHealthy
    ? "var(--accent-cyan)"
    : "var(--accent)";

  const STAGE_LABELS = {
    volume: "VOLUME BAIXO",
    triagem: "GARGALO: CV/TRIAGEM",
    hm: "GARGALO: HIRING MANAGER",
    final: "GARGALO: ENTREVISTA FINAL",
    offer: "GARGALO: FECHAMENTO",
    saudavel: "FUNIL SAUDÁVEL",
  };

  return (
    <div
      className="ct-highlight-banner"
      style={{ borderLeftColor: borderColor, marginTop: 24 }}
      role="status"
      aria-label={`Análise do funil: ${STAGE_LABELS[analysis.stage]}`}
    >
      <div
        className="ct-highlight-banner-icon"
        style={
          isHealthy
            ? {}
            : {
                // Gradient temático: usa accent (cyan/lime) com leve transparencia
                // pra dar profundidade no icone sem hardcode de hex.
                background:
                  "linear-gradient(140deg, var(--accent) 0%, var(--accent) 100%)",
                boxShadow: "0 4px 14px -2px rgba(0,0,0,.18)",
              }
        }
        aria-hidden="true"
      >
        {isHealthy ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v4M12 17h.01M10.3 3.86l-8.4 14.55A2 2 0 003.66 21h16.68a2 2 0 001.72-2.59L13.7 3.86a2 2 0 00-3.4 0z" />
          </svg>
        )}
      </div>
      <div className="ct-highlight-banner-content">
        <div
          className="ct-page-header-eyebrow"
          style={{ marginBottom: 4 }}
        >
          {STAGE_LABELS[analysis.stage]}
        </div>
        <p className="ct-highlight-banner-desc">{analysis.suggestion}</p>
        <p
          className="ct-highlight-banner-desc"
          style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}
        >
          Baseado em {aggregated.applications} candidaturas das últimas 4
          semanas.
        </p>
      </div>
      {analysis.link && (
        <Link
          href={analysis.link}
          className="ct-highlight-banner-cta"
          aria-label="Ir para a ação sugerida"
        >
          Agir agora
        </Link>
      )}
    </div>
  );
}

function HistoryTable({ entries }) {
  return (
    <section style={{ marginTop: 28 }} aria-label="Histórico das últimas semanas">
      <h2
        className="ct-page-header-eyebrow"
        style={{ marginBottom: 12 }}
      >
        HISTÓRICO (ÚLTIMAS {entries.length} SEMANAS)
      </h2>
      <div
        className="app-glass"
        style={{
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                <Th>Semana</Th>
                <Th align="right">Aplicações</Th>
                <Th align="right">Callbacks</Th>
                <Th align="right">HMs</Th>
                <Th align="right">Finais</Th>
                <Th align="right">Offers</Th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr
                  key={e.id}
                  style={{
                    borderTop: i === 0 ? "none" : "1px solid var(--border)",
                  }}
                >
                  <Td>
                    {formatWeekLabel(e.weekStart)}
                    {i === 0 && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 10,
                          fontWeight: 700,
                          color: "var(--accent-cyan-deep)",
                          letterSpacing: ".1em",
                        }}
                      >
                        ATUAL
                      </span>
                    )}
                  </Td>
                  <Td align="right">{e.applications}</Td>
                  <Td align="right">{e.callbacks}</Td>
                  <Td align="right">{e.hmConversations}</Td>
                  <Td align="right">{e.finals}</Td>
                  <Td align="right">{e.offers}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Th({ children, align = "left" }) {
  return (
    <th
      style={{
        textAlign: align,
        padding: "10px 14px",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: ".1em",
        color: "var(--text-muted)",
        fontWeight: 700,
      }}
    >
      {children}
    </th>
  );
}

function Td({ children, align = "left" }) {
  return (
    <td
      style={{
        textAlign: align,
        padding: "12px 14px",
        fontSize: 14,
        color: "var(--text)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {children}
    </td>
  );
}
