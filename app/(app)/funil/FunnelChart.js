"use client";

// FunnelChart — SVG inline simples, 5 barras horizontais representando os
// estagios do funil (applications -> callbacks -> hmConversations -> finals
// -> offers). Largura proporcional ao count, normalizada por applications
// (o maior numero, no topo).
//
// Sem lib de chart — SVG manual com ~5 elementos. Mantem bundle leve e
// evita dependencia extra.

const STAGES = [
  { key: "applications", label: "Aplicacoes", short: "APPS" },
  { key: "callbacks", label: "Callbacks", short: "CALLBACKS" },
  { key: "hmConversations", label: "Hiring Managers", short: "HMs" },
  { key: "finals", label: "Entrevistas finais", short: "FINAIS" },
  { key: "offers", label: "Offers", short: "OFFERS" },
];

function pct(numerator, denominator) {
  if (!denominator || denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

// Mapeia stage do bottleneck pro index da barra que deve ser destacada.
const STAGE_TO_INDEX = {
  triagem: 1, // callbacks
  hm: 2,
  final: 3,
  offer: 4,
};

export default function FunnelChart({ aggregated, analysis }) {
  if (!aggregated) return null;

  const apps = Number(aggregated.applications) || 0;
  if (apps <= 0) return null;

  // Max do funil e sempre applications (topo). Outras barras sao proporcionais.
  const counts = STAGES.map((s) => ({
    ...s,
    count: Number(aggregated[s.key]) || 0,
  }));

  // Destaca a barra que e o gargalo (border colorida) — ajuda a leitura visual.
  const highlightIdx =
    analysis && STAGE_TO_INDEX[analysis.stage] !== undefined
      ? STAGE_TO_INDEX[analysis.stage]
      : -1;

  // Dimensoes do SVG. Cada barra = 56px altura + 12px gap.
  const BAR_HEIGHT = 36;
  const BAR_GAP = 18;
  const LABEL_HEIGHT = 18;
  const ROW = BAR_HEIGHT + BAR_GAP + LABEL_HEIGHT;
  const HEIGHT = STAGES.length * ROW + 12;

  // viewBox usa 100 de largura — escala fluidamente. Margin esquerda pro label,
  // margin direita pro valor numerico.
  const LEFT = 90; // espaco pros labels textuais
  const RIGHT = 60; // espaco pros valores numericos
  const CHART_W = 1000; // largura virtual do SVG
  const BAR_AREA = CHART_W - LEFT - RIGHT;

  return (
    <section
      style={{ marginTop: 28 }}
      aria-label="Visualizacao do funil"
    >
      <h2
        style={{
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: ".1em",
          color: "var(--text-muted)",
          fontWeight: 700,
          marginBottom: 12,
        }}
      >
        FUNIL (AGREGADO 4 SEMANAS)
      </h2>
      <div
        className="app-glass"
        style={{
          borderRadius: "var(--radius-lg)",
          padding: "22px 22px 8px",
        }}
      >
        <svg
          viewBox={`0 0 ${CHART_W} ${HEIGHT}`}
          width="100%"
          style={{ display: "block", maxWidth: "100%" }}
          role="img"
          aria-label="Funil de candidaturas: barras horizontais decrescentes por estagio"
        >
          <defs>
            <linearGradient id="funnel-bar-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--accent-cyan)" />
              <stop offset="100%" stopColor="var(--accent-cyan-deep, var(--accent-cyan))" />
            </linearGradient>
            <filter id="funnel-bar-attention" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {counts.map((s, i) => {
            const widthRatio = apps > 0 ? s.count / apps : 0;
            const w = Math.max(2, Math.round(BAR_AREA * widthRatio));
            const y = i * ROW;
            const isHighlight = i === highlightIdx;
            const fromPrev =
              i === 0 ? null : pct(s.count, counts[i - 1].count);

            return (
              <g key={s.key}>
                {/* Label do estagio */}
                <text
                  x={LEFT - 10}
                  y={y + BAR_HEIGHT / 2 + 5}
                  textAnchor="end"
                  fontSize="14"
                  fontWeight="600"
                  fill="var(--text)"
                >
                  {s.short}
                </text>

                {/* Sombra/track da barra (fundo) */}
                <rect
                  x={LEFT}
                  y={y}
                  width={BAR_AREA}
                  height={BAR_HEIGHT}
                  fill="var(--surface-2)"
                  rx="6"
                />

                {/* Barra preenchida — gradient cyan-to-cyan-deep. Highlight
                    do bottleneck recebe stroke alert + glow filter. */}
                <rect
                  x={LEFT}
                  y={y}
                  width={w}
                  height={BAR_HEIGHT}
                  fill="url(#funnel-bar-gradient)"
                  rx="6"
                  opacity={isHighlight ? 1 : 0.92}
                  stroke={isHighlight ? "var(--alert, #E5A93C)" : "none"}
                  strokeWidth={isHighlight ? 2.5 : 0}
                  filter={isHighlight ? "url(#funnel-bar-attention)" : undefined}
                  style={isHighlight ? { filter: "drop-shadow(0 0 12px var(--alert, #E5A93C))" } : undefined}
                />

                {/* Valor numerico a direita */}
                <text
                  x={LEFT + BAR_AREA + 10}
                  y={y + BAR_HEIGHT / 2 + 5}
                  textAnchor="start"
                  fontSize="14"
                  fontWeight="700"
                  fill="var(--text)"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {s.count}
                </text>

                {/* Linha de label abaixo: % de conversao do estagio anterior */}
                <text
                  x={LEFT}
                  y={y + BAR_HEIGHT + 14}
                  fontSize="11"
                  fill="var(--text-muted)"
                  letterSpacing="0.06em"
                >
                  {fromPrev !== null
                    ? `${fromPrev}% de ${counts[i - 1].short.toLowerCase()}`
                    : "topo do funil"}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <p
        style={{
          marginTop: 8,
          fontSize: 12,
          color: "var(--text-subtle)",
        }}
      >
        Cada barra mostra o volume absoluto do estagio. A porcentagem indica a
        taxa de conversao em relacao ao estagio anterior.
      </p>
    </section>
  );
}
