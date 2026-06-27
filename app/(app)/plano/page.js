import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Render dinamico: auth() (cookies) + Prisma. Nada disso pode ser cacheado.
export const dynamic = "force-dynamic";
export const metadata = { title: "Plano de evolucao — CareerTwin AI" };

// Espelha a logica de /api/score/latest-with-history + /api/history/score +
// /api/history/actions, mas direto via Prisma. Sem chamada HTTP interna (URL
// absoluta chata em dev/preview/prod). Mesmo escopo de dono explicito em 2
// passos pra evitar IDOR via nested-where do Prisma (mesmo padrao do
// route.js de /api/history/actions).
export default async function PlanoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/entrar");

  const userId = session.user.id;

  // Snapshots crescentes pro chart (Jan -> Hoje). Limit 100 igual a API.
  const snapshots = await prisma.scoreSnapshot.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { id: true, overall: true, createdAt: true, role: true },
    take: 100,
  });

  const snapshotIds = snapshots.map((s) => s.id);

  // Gaps + PlanItems concluidos + ApplicationEvents. Cada bloco e isolado pra
  // tolerar dataset vazio (no Prisma, `in: []` retornaria zero rows, mas
  // evitamos a query inteira por carinho com o DB).
  const [completedGaps, completedPlanItems, appEvents] = await Promise.all([
    snapshotIds.length
      ? prisma.gap.findMany({
          where: { snapshotId: { in: snapshotIds }, completedAt: { not: null } },
          orderBy: { completedAt: "desc" },
          take: 30,
        })
      : Promise.resolve([]),
    snapshotIds.length
      ? prisma.planItem.findMany({
          where: { snapshotId: { in: snapshotIds }, completedAt: { not: null } },
          orderBy: { completedAt: "desc" },
          take: 30,
        })
      : Promise.resolve([]),
    (async () => {
      const apps = await prisma.application.findMany({
        where: { userId },
        select: { id: true, titulo: true, empresa: true },
        take: 200,
      });
      if (!apps.length) return [];
      const appById = new Map(apps.map((a) => [a.id, a]));
      const events = await prisma.applicationEvent.findMany({
        where: { applicationId: { in: apps.map((a) => a.id) } },
        orderBy: { occurredAt: "desc" },
        take: 30,
      });
      return events.map((e) => ({ ...e, _app: appById.get(e.applicationId) }));
    })(),
  ]);

  const points = snapshots; // ja asc
  const latest = points[points.length - 1] || null;
  const first = points[0] || null;
  const deltaFromFirst = latest && first ? latest.overall - first.overall : 0;

  // Timeline UNION das 4 fontes — mesmo formato do /api/history/actions, mas
  // com strings do label nativas (sem acento perdido).
  const timeline = [
    ...completedGaps.map((g) => ({
      type: "gap_completed",
      date: g.completedAt,
      title: `Concluiu: ${g.habilidade}`,
      detail: g.microacao || "",
      tag: "Skill",
    })),
    ...completedPlanItems.map((p) => ({
      type: "plan_completed",
      date: p.completedAt,
      title: `Completou: ${p.titulo}`,
      detail: p.impacto || "",
      tag: `Semana ${p.semana}`,
    })),
    ...appEvents.map((e) => {
      const titulo = e._app?.titulo || "Candidatura";
      const empresa = e._app?.empresa || "";
      const status = e.toStatus || e.fromStatus || "atualizada";
      return {
        type: "application_event",
        date: e.occurredAt,
        title: `${titulo} — ${status}`,
        detail: empresa,
        tag: "Candidatura",
      };
    }),
    ...points.map((s) => ({
      type: "diagnosis",
      date: s.createdAt,
      title: `Novo diagnóstico (${s.role})`,
      detail: `Score: ${s.overall}`,
      tag: "Diagnóstico",
    })),
  ]
    .filter((item) => item.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 30);

  return (
    <main id="main-content" className="app-container">
      {/* Header — Arwen uplift: mesh sutil + eyebrow + typography ambicioso
          clamp() + spacing generoso. Eyebrow "Plano de evolucao" porque o titulo
          em si nao da contexto temporal claro. */}
      <div
        className="ct-gaps-header site-section-mesh"
        style={{
          paddingTop: "clamp(56px, 9vw, 96px)",
          paddingBottom: "clamp(32px, 5vw, 64px)",
          marginBottom: "clamp(32px, 5vw, 64px)",
        }}
      >
        <div>
          <span
            style={{
              display: "inline-block",
              fontSize: "12px",
              fontWeight: 600,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--accent-cyan-deep)",
              marginBottom: "14px",
            }}
          >
            Plano de evolução
          </span>
          {/* Arwen v4 — H1 unificado em ct-page-header-title (canonico). */}
          <h1 className="ct-page-header-title">
            Sua evolução, ao longo do tempo
          </h1>
          <p
            className="ct-gaps-sub"
            style={{
              fontSize: "clamp(16px, 1.4vw, 19px)",
              lineHeight: 1.55,
              color: "var(--text-muted)",
              maxWidth: "62ch",
            }}
          >
            Seu gêmeo acompanha você ao longo do tempo — não é um retrato
            estático.
          </p>
        </div>
      </div>

      {/* Card: saude da carreira ao longo do tempo — Pippin v2: envelopa em
          .app-glass pra glassmorphism premium + accent border-top sutil. */}
      <div
        className="ct-chart-card app-glass"
        style={{
          padding: "clamp(20px, 2.5vw, 32px)",
          borderRadius: 16,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background: "linear-gradient(90deg, transparent, var(--accent), transparent)",
            opacity: 0.5,
          }}
        />
        <div className="ct-chart-head">
          <div>
            <div className="ct-chart-title">
              Saúde da carreira ao longo do tempo
            </div>
            <div className="ct-chart-sub">Recalculado a cada diagnóstico</div>
          </div>
          {deltaFromFirst !== 0 && first && (
            <div className="ct-chart-delta">
              <div
                className={
                  deltaFromFirst > 0
                    ? "ct-delta-positive"
                    : "ct-delta-attention"
                }
                style={{
                  color: deltaFromFirst > 0 ? "var(--accent)" : undefined,
                  textShadow:
                    deltaFromFirst > 0
                      ? "0 0 24px var(--accent)"
                      : undefined,
                }}
              >
                {deltaFromFirst > 0 ? "+" : ""}
                {deltaFromFirst} pontos
              </div>
              <div className="ct-chart-sub">
                desde{" "}
                {new Date(first.createdAt).toLocaleDateString("pt-BR", {
                  month: "long",
                  year: "numeric",
                })}
              </div>
            </div>
          )}
        </div>
        {points.length === 0 ? (
          <EditorialEmpty
            eyebrow="Primeiro passo"
            title="Seu gêmeo ainda não tem com o que comparar"
          >
            Faça seu primeiro diagnóstico no{" "}
            <Link
              href="/dashboard"
              style={{
                color: "var(--accent)",
                textDecoration: "underline",
                textUnderlineOffset: 3,
              }}
            >
              seu dashboard
            </Link>
            {" "}— a partir do segundo, esta página mostra evolução real.
          </EditorialEmpty>
        ) : points.length === 1 ? (
          <EditorialEmpty
            eyebrow="Snapshot inicial salvo"
            title="Volte daqui a 2-4 semanas"
          >
            Refaça o diagnóstico com CV atualizado pra desenhar a primeira
            linha de evolução real.
          </EditorialEmpty>
        ) : (
          <ScoreChart points={points} />
        )}
      </div>

      {/* Timeline — h2 com underline + container .app-glass (Pippin v2). */}
      <h2
        className="ct-actions-title"
        style={{
          marginTop: "clamp(48px, 6vw, 72px)",
          marginBottom: 18,
          fontSize: "clamp(22px, 2.6vw, 30px)",
          fontWeight: 600,
          letterSpacing: "-0.01em",
          paddingBottom: 12,
          borderBottom: "1px solid var(--border, rgba(255,255,255,0.08))",
        }}
      >
        Linha do tempo das ações
      </h2>
      <div
        className="ct-timeline app-glass"
        style={{
          padding: "clamp(20px, 2.5vw, 32px)",
          borderRadius: 16,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            background: "linear-gradient(90deg, transparent, var(--accent), transparent)",
            opacity: 0.5,
          }}
        />
        {timeline.length === 0 ? (
          <EditorialEmpty
            eyebrow="Diário em branco"
            title="Suas ações vão aparecer aqui"
          >
            Conforme você completar microações, atualizar candidaturas e
            refazer diagnósticos, sua jornada se constrói visualmente nesta
            timeline.
          </EditorialEmpty>
        ) : (
          timeline.map((item, i) => (
            <TimelineRow
              key={i}
              item={item}
              isLast={i === timeline.length - 1}
            />
          ))
        )}
      </div>
    </main>
  );
}

// Estado vazio editorial: eyebrow mono + h3 + body. Pippin v2 — substitui
// os "Sem dados" planos por algo com tom de produto premium. Re-utilizado
// pelos 3 estados vazios (no snapshots, 1 snapshot, timeline vazia).
function EditorialEmpty({ eyebrow, title, children }) {
  return (
    <div
      style={{
        padding: "clamp(32px, 5vw, 56px) 24px",
        textAlign: "center",
      }}
    >
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.18em",
          textTransform: "uppercase",
          color: "var(--accent)",
          fontFamily: "var(--font-mono, ui-monospace, monospace)",
          marginBottom: 12,
        }}
      >
        {eyebrow}
      </p>
      <h3
        style={{
          fontSize: "clamp(20px, 2.4vw, 28px)",
          fontWeight: 600,
          letterSpacing: "-0.01em",
          lineHeight: 1.2,
          marginBottom: 12,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          color: "var(--fg-muted, var(--text-muted))",
          maxWidth: "52ch",
          margin: "0 auto",
          lineHeight: 1.55,
        }}
      >
        {children}
      </p>
    </div>
  );
}

// Chart SVG manual (sem lib externa) com escala adaptativa.
// Estrategia de scaling:
// - Eixo Y se ajusta entre [min-10, max+10] com piso minimo de span=10.
//   Isso evita "chart liso" quando todos os snapshots oscilam em poucos pontos
//   (ex: 64, 67, 70) e tambem evita expandir demais quando o salto e grande
//   (0 -> 95). Ancorar SEMPRE em [0,100] deixaria pequenas oscilacoes invisiveis.
// - Eixo X distribui os N pontos uniformemente em innerW (sem clamping por
//   data — tratamos como sequencia ordinal de diagnosticos, nao linha de tempo
//   real proporcional). Pra 30 pontos isso ainda da ~20px entre cada um no
//   viewBox de 640, suficiente pra leitura.
// - Ultimo ponto destacado (raio maior + cor primary) pra fixar "vc esta aqui".
function ScoreChart({ points }) {
  const overalls = points.map((p) => p.overall);
  const rawMax = Math.max(...overalls);
  const rawMin = Math.min(...overalls);
  const span = Math.max(10, rawMax - rawMin);
  const padTop = Math.min(100, rawMax + Math.max(5, Math.round(span * 0.15)));
  const padBottom = Math.max(0, rawMin - Math.max(5, Math.round(span * 0.15)));

  const W = 640;
  const H = 230;
  const padX = 50;
  const innerW = W - padX - 20;
  const innerH = 160;
  const topY = 50;
  const bottomY = topY + innerH;

  const n = points.length;
  const xs = points.map((_, i) =>
    n === 1 ? padX + innerW / 2 : padX + (innerW * i) / (n - 1),
  );
  const ys = points.map(
    (p) =>
      bottomY - ((p.overall - padBottom) / (padTop - padBottom || 1)) * innerH,
  );

  const linePath = points
    .map(
      (_, i) => `${i === 0 ? "M" : "L"}${xs[i].toFixed(1)},${ys[i].toFixed(1)}`,
    )
    .join(" ");
  const areaPath = `${linePath} L${xs[xs.length - 1].toFixed(1)},${bottomY} L${xs[0].toFixed(1)},${bottomY} Z`;

  // Densidade dos labels de data: se >12 pontos, mostra so 1 a cada N pra nao
  // poluir o eixo X. O ultimo ponto sempre aparece (ancora visual de "hoje").
  const labelStride = n > 12 ? Math.ceil(n / 8) : 1;

  // a11y: resumo verbal do chart pra SR. Inclui ponto inicial, ultimo,
  // delta e contagem de snapshots — info que o grafico mostra visualmente.
  const firstP = points[0];
  const lastP = points[points.length - 1];
  const delta = lastP.overall - firstP.overall;
  const chartLabel = `Evolução do score: ${points.length} snapshots, de ${firstP.overall} até ${lastP.overall} (${delta >= 0 ? "+" : ""}${delta} pontos)`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: "auto", display: "block" }}
      role="img"
      aria-label={chartLabel}
    >
      <defs>
        <linearGradient id="ct-plano-areag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--primary-light)" stopOpacity="0.25" />
          <stop offset="1" stopColor="var(--primary-light)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((frac, i) => {
        const y = topY + frac * innerH;
        const value = Math.round(padTop - frac * (padTop - padBottom));
        return (
          <g key={i}>
            <line
              x1={padX}
              y1={y}
              x2={W - 20}
              y2={y}
              stroke="var(--border)"
              strokeWidth="1"
            />
            <text
              x={padX - 8}
              y={y + 4}
              fontSize="11"
              fill="var(--text-faint)"
              textAnchor="end"
              fontFamily="var(--font-body)"
            >
              {value}
            </text>
          </g>
        );
      })}
      <path d={areaPath} fill="url(#ct-plano-areag)" />
      <path
        d={linePath}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => {
        const isLast = i === points.length - 1;
        const showDate = isLast || i % labelStride === 0;
        return (
          <g key={p.id}>
            <circle
              cx={xs[i]}
              cy={ys[i]}
              r={isLast ? 6 : 4.5}
              fill={isLast ? "var(--primary)" : "var(--bg)"}
              stroke="var(--primary)"
              strokeWidth="2.5"
            />
            {showDate && (
              <text
                x={xs[i]}
                y={H - 12}
                fontSize="10"
                fill="var(--text-faint)"
                textAnchor="middle"
                fontFamily="var(--font-body)"
              >
                {new Date(p.createdAt).toLocaleDateString("pt-BR", {
                  month: "short",
                  day: "numeric",
                })}
              </text>
            )}
            <text
              x={xs[i]}
              y={ys[i] - 12}
              fontSize="11"
              fontWeight="700"
              fill={isLast ? "var(--primary)" : "var(--text-muted)"}
              textAnchor="middle"
              fontFamily="var(--font-body)"
            >
              {p.overall}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// Linha da timeline: data | dot com icone | titulo + tag + detalhe.
// iconMap usa stroke da paleta semantica (positive/primary/attention) e bg
// soft pra contraste leve. tagColorMap espelha pra mesma vibe na tag.
function TimelineRow({ item, isLast }) {
  const date = new Date(item.date);
  const dateStr = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
  const iconMap = {
    gap_completed: {
      color: "var(--positive)",
      bg: "var(--positive-soft)",
      path: "M5 12.5l4.5 4.5L19 7",
    },
    plan_completed: {
      color: "var(--primary)",
      bg: "var(--primary-soft)",
      path: "M9 11l3 3 8-8",
    },
    application_event: {
      color: "var(--attention)",
      bg: "var(--attention-soft)",
      path: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z",
    },
    diagnosis: {
      color: "var(--primary)",
      bg: "var(--primary-soft)",
      path: "M12 2l8 4v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6z",
    },
  };
  const icon = iconMap[item.type] || iconMap.diagnosis;
  const tagColorMap = {
    Skill: { color: "var(--positive-deep)", bg: "var(--positive-soft)" },
    Diagnóstico: { color: "var(--primary)", bg: "var(--primary-soft)" },
    Candidatura: { color: "var(--attention-deep)", bg: "var(--attention-soft)" },
  };
  const tagStyle =
    tagColorMap[item.tag] || {
      color: "var(--text-muted)",
      bg: "var(--surface-2)",
    };

  return (
    <div
      className="ct-timeline-row app-glass"
      style={{
        padding: "16px 18px",
        borderRadius: 12,
        marginBottom: isLast ? 0 : 10,
        transition: "transform 160ms ease, border-color 160ms ease",
      }}
      onMouseEnter={undefined}
    >
      <div className="ct-timeline-date">{dateStr}</div>
      <div className="ct-timeline-dot-col">
        <div className="ct-timeline-dot" style={{ background: icon.bg }}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke={icon.color}
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d={icon.path} />
          </svg>
        </div>
        {!isLast && <div className="ct-timeline-line" aria-hidden="true" />}
      </div>
      <div className="ct-timeline-content">
        <div className="ct-timeline-head">
          <span className="ct-timeline-title">{item.title}</span>
          <span
            className="ct-timeline-tag"
            style={{ color: tagStyle.color, background: tagStyle.bg }}
          >
            {item.tag}
          </span>
        </div>
        {item.detail && <p className="ct-timeline-detail">{item.detail}</p>}
      </div>
    </div>
  );
}
