"use client";

// SkillGraph — visualizacao radial das skills do user vs skills que o cargo-alvo
// pede. Implementacao em SVG puro (sem D3) pra evitar dependencia extra:
//   - centro = cargo-alvo
//   - anel interno = skills que user tem E cargo pede (verde)
//   - anel intermediario = skills que user tem mas cargo nao pede (indigo soft)
//   - anel externo = skills que cargo pede mas user nao tem (amarelo atencao)
//
// Acessibilidade:
//   - SVG tem role="img" + aria-label descritivo do contexto
//   - Hover usa onMouseEnter/onMouseLeave (desktop) + onFocus/onBlur (teclado)
//   - Touch: onTouchStart no <g> dispara a tooltip (workaround porque mouseenter
//     nao roda confiavel em mobile; alguns browsers disparam mas e instavel)
//   - tooltip tem aria-live="polite" pra leitor de tela anunciar mudanca
//
// Defesa em depth: skills sao normalizadas (lowercase trim), filtra falsy.
// Quando arrays vem null/undefined, useMemo gera lista vazia e o grafo
// renderiza so o centro (sem nodes). Nao quebra.

import { useState, useMemo, useCallback } from "react";

// Posicao do centro e raios dos aneis. ViewBox 560x480 fixo — width 100% no
// container responsivo. Esses valores foram escolhidos pra caber os 3 aneis
// com folga (anel externo a 200px de raio + raio do node 22 = 222, ainda
// dentro do quadrado de 480).
const CENTER_X = 280;
const CENTER_Y = 240;
const RADIUS_INNER = 80;
const RADIUS_MID = 140;
const RADIUS_OUTER = 200;
const NODE_RADIUS = 22;

export default function SkillGraph({
  profileSkills,
  targetSkills,
  role,
  height = 480,
}) {
  const [hovered, setHovered] = useState(null);

  // Normaliza ambas listas: lowercase + trim + remove falsy.
  // useMemo evita re-rodar a cada hover (que muda state mas nao deps).
  const profile = useMemo(
    () =>
      Array.isArray(profileSkills)
        ? profileSkills
            .map((s) => String(s || "").toLowerCase().trim())
            .filter(Boolean)
        : [],
    [profileSkills],
  );
  const target = useMemo(
    () =>
      Array.isArray(targetSkills)
        ? targetSkills
            .map((s) => String(s || "").toLowerCase().trim())
            .filter(Boolean)
        : [],
    [targetSkills],
  );

  // Categoriza skills nas 3 buckets do grafo. Sets pra lookup O(1).
  const { have, haveExtra, missing } = useMemo(() => {
    const profileSet = new Set(profile);
    const targetSet = new Set(target);
    return {
      have: profile.filter((s) => targetSet.has(s)),
      haveExtra: profile.filter((s) => !targetSet.has(s)),
      missing: target.filter((s) => !profileSet.has(s)),
    };
  }, [profile, target]);

  // Distribui items em um aneis circular. Comeca no topo (-PI/2) e vai
  // sentido horario. Step = 2PI/n, entao n=4 ja desenha um quadrado.
  const havePoints = useMemo(
    () => pointsOnRing(have, RADIUS_INNER),
    [have],
  );
  const haveExtraPoints = useMemo(
    () => pointsOnRing(haveExtra, RADIUS_MID),
    [haveExtra],
  );
  const missingPoints = useMemo(
    () => pointsOnRing(missing, RADIUS_OUTER),
    [missing],
  );

  // Callback estavel pra nao recriar a cada render dos nodes.
  const handleHover = useCallback((payload) => {
    setHovered(payload);
  }, []);

  // aria-label descritivo: incluir contagens ajuda leitor de tela a entender
  // o conteudo sem precisar narrar cada node.
  const ariaLabel = role
    ? `Mapa de skills para ${role}. ${have.length} skills alinhadas, ${haveExtra.length} extras, ${missing.length} faltando.`
    : `Mapa de skills. ${have.length} alinhadas, ${haveExtra.length} extras, ${missing.length} faltando.`;

  return (
    <div className="ct-skill-graph-wrap" style={{ minHeight: height }}>
      <svg
        viewBox="0 0 560 480"
        width="100%"
        height="100%"
        role="img"
        aria-label={ariaLabel}
        style={{ display: "block" }}
      >
        {/* Aneis guia (tracejados, sutis) — ajudam o olho a perceber os
            grupos sem competir com os nodes. */}
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={RADIUS_INNER}
          fill="none"
          stroke="var(--border)"
          strokeDasharray="2 4"
        />
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={RADIUS_MID}
          fill="none"
          stroke="var(--border)"
          strokeDasharray="2 4"
        />
        <circle
          cx={CENTER_X}
          cy={CENTER_Y}
          r={RADIUS_OUTER}
          fill="none"
          stroke="var(--border)"
          strokeDasharray="2 4"
        />

        {/* Linhas centro -> have (verde solido). Sugerem "skills firmes
            que sustentam o cargo-alvo". */}
        {havePoints.map((p) => (
          <line
            key={"line-have-" + p.label}
            x1={CENTER_X}
            y1={CENTER_Y}
            x2={p.x}
            y2={p.y}
            stroke="var(--positive)"
            strokeOpacity="0.4"
            strokeWidth="1.5"
          />
        ))}

        {/* Linhas centro -> haveExtra (indigo tint sutil). Skills que voce
            tem mas nao agregam pro cargo-alvo. */}
        {haveExtraPoints.map((p) => (
          <line
            key={"line-extra-" + p.label}
            x1={CENTER_X}
            y1={CENTER_Y}
            x2={p.x}
            y2={p.y}
            stroke="var(--primary-tint)"
            strokeOpacity="0.3"
            strokeWidth="1"
          />
        ))}

        {/* Linhas centro -> missing (atencao, tracejada). Visual "caminho
            a percorrer" — o tracejado reforca que nao esta firmado ainda. */}
        {missingPoints.map((p) => (
          <line
            key={"line-miss-" + p.label}
            x1={CENTER_X}
            y1={CENTER_Y}
            x2={p.x}
            y2={p.y}
            stroke="var(--attention)"
            strokeOpacity="0.4"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
        ))}

        {/* Centro: cargo-alvo. Trunca em 18 chars pra nao estourar o
            circulo. Texto cheio aparece na legenda/contexto da pagina. */}
        <g>
          <circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r="46"
            fill="var(--primary-soft)"
            stroke="var(--primary)"
            strokeWidth="2"
          />
          <text
            x={CENTER_X}
            y={CENTER_Y - 6}
            textAnchor="middle"
            fontFamily="var(--font-display)"
            fontSize="11"
            fontWeight="700"
            fill="var(--text-soft)"
          >
            CARGO-ALVO
          </text>
          <text
            x={CENTER_X}
            y={CENTER_Y + 12}
            textAnchor="middle"
            fontFamily="var(--font-display)"
            fontSize="13"
            fontWeight="800"
            fill="var(--text)"
          >
            {truncate(role || "—", 18)}
          </text>
        </g>

        {/* Nodes — renderizados depois das linhas pra ficarem por cima. */}
        {havePoints.map((p) => (
          <SkillNode
            key={"node-have-" + p.label}
            p={p}
            variant="have"
            onHover={handleHover}
          />
        ))}
        {haveExtraPoints.map((p) => (
          <SkillNode
            key={"node-extra-" + p.label}
            p={p}
            variant="extra"
            onHover={handleHover}
          />
        ))}
        {missingPoints.map((p) => (
          <SkillNode
            key={"node-miss-" + p.label}
            p={p}
            variant="missing"
            onHover={handleHover}
          />
        ))}
      </svg>

      <div className="ct-skill-graph-legend" aria-hidden="true">
        <span className="legend-item have">
          <span className="dot" /> Tem e cargo pede ({have.length})
        </span>
        <span className="legend-item extra">
          <span className="dot" /> Tem mas cargo não pede ({haveExtra.length})
        </span>
        <span className="legend-item missing">
          <span className="dot" /> Falta pro cargo ({missing.length})
        </span>
      </div>

      {/* Tooltip controlada por state. aria-live anuncia mudancas pra
          leitor de tela. role="status" e correto pra mensagens informativas. */}
      {hovered && (
        <div
          className="ct-skill-graph-tooltip"
          role="status"
          aria-live="polite"
        >
          <strong>{hovered.label}</strong>
          <span>{describeVariant(hovered.variant)}</span>
        </div>
      )}
    </div>
  );
}

// SkillNode — um <g> clicavel pra desktop e touch. tabIndex=0 + onFocus/onBlur
// pra navegacao por teclado. focusable="true" e necessario porque SVG nao
// herda comportamento de foco do HTML — sem isso o Tab pula.
function SkillNode({ p, variant, onHover }) {
  const colors = VARIANT_COLORS[variant];
  const display = p.label.length > 8 ? p.label.slice(0, 7) + "…" : p.label;

  // Handlers — encapsula payload pra parent saber o que tem hover.
  const show = () => onHover({ label: p.label, variant });
  const hide = () => onHover(null);

  return (
    <g
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onTouchStart={show}
      tabIndex={0}
      focusable="true"
      role="button"
      aria-label={`${p.label} — ${describeVariant(variant)}`}
      style={{ cursor: "pointer", outline: "none" }}
    >
      <circle
        cx={p.x}
        cy={p.y}
        r={NODE_RADIUS}
        fill={colors.fill}
        stroke={colors.stroke}
        strokeWidth="2"
      />
      <text
        x={p.x}
        y={p.y + 4}
        textAnchor="middle"
        fontFamily="var(--font-body)"
        fontSize="9"
        fontWeight="700"
        fill={colors.text}
        pointerEvents="none"
      >
        {display}
      </text>
    </g>
  );
}

// Mapa de variantes -> tokens de cor. Centralizado pra trocar paleta sem
// caca-tesouro pelos componentes.
const VARIANT_COLORS = {
  have: {
    fill: "var(--positive)",
    stroke: "var(--positive-deep)",
    text: "#FFFFFF",
  },
  extra: {
    fill: "var(--primary-soft)",
    stroke: "var(--primary)",
    text: "var(--text)",
  },
  missing: {
    fill: "var(--attention-soft)",
    stroke: "var(--attention)",
    text: "var(--text)",
  },
};

function describeVariant(variant) {
  switch (variant) {
    case "have":
      return "Você tem e o cargo pede";
    case "extra":
      return "Você tem mas o cargo não pede";
    case "missing":
      return "Cargo pede, você não tem ainda";
    default:
      return "";
  }
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// Distribui items em torno de um circulo de raio dado. Comeca em -PI/2
// (topo) e gira sentido horario. Retorna array com {label, x, y} pra
// renderizar tanto <line> quanto <SkillNode>.
function pointsOnRing(items, radius) {
  if (!items.length) return [];
  const step = (2 * Math.PI) / items.length;
  return items.map((label, i) => ({
    label,
    x: CENTER_X + Math.cos(i * step - Math.PI / 2) * radius,
    y: CENTER_Y + Math.sin(i * step - Math.PI / 2) * radius,
  }));
}
