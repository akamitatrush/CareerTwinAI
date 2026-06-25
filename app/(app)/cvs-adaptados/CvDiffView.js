"use client";

import { useMemo, useState } from "react";
import {
  diffLines,
  alignSideBySide,
  lineStats,
  changePercent,
} from "@/lib/text-diff";

// Render do diff visual entre original e adaptado.
//
// Modos:
//  - "side": 2 colunas alinhadas. Linhas equal sem highlight, insert verde,
//    delete vermelho, changed amarelo com diff word-level inline.
//  - "unified": 1 coluna com prefix +/- /  (3 chars largura fixa, font mono).
//
// Acessibilidade:
//  - Usamos <pre>+<code> semanticamente, com role="row"/"cell" pra aria sem
//    bagunca de layout. Optei por NAO usar <table>: tabela tradicional perde
//    quebra de linha responsiva e o screen reader le como "tabela de N linhas
//    com 2 colunas", o que e ruim pra texto corrido. Diff e mais um "registro
//    de mudancas" do que "dados tabulares" — semantica mais proxima de <pre>.
//    Padrao similar ao Github diff view e GitLab.
//  - Toggle: aria-pressed indica estado, label descritivo no botao.
//  - Cores complementadas por prefix (+, -, ~) e simbolo no canto da linha
//    pra usuarios daltonicos (deuteranopia: verde/vermelho similares).
//  - Color-contrast: usamos cores soft (10-15% saturacao) sobre texto escuro
//    pra manter WCAG AA (>4.5:1).
//
// Performance: alignSideBySide e diffLines memoizados. Pra CV 5k chars
// (~200 linhas) ~1ms. Re-render apenas no toggle de modo (cheap).
export default function CvDiffView({ original = "", tailored = "" }) {
  const [mode, setMode] = useState("side"); // "side" | "unified"

  const rows = useMemo(() => {
    const ops = diffLines(original, tailored);
    return alignSideBySide(ops);
  }, [original, tailored]);

  const unifiedOps = useMemo(() => diffLines(original, tailored), [original, tailored]);

  const stats = useMemo(() => lineStats(diffLines(original, tailored)), [original, tailored]);
  const pct = changePercent(stats);

  return (
    <section className="ct-cv-diff" aria-label="Comparacao antes e depois do CV">
      <div
        className="ct-cv-diff-toolbar"
        role="toolbar"
        aria-label="Modo de visualizacao do diff"
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <button
          type="button"
          onClick={() => setMode("side")}
          aria-pressed={mode === "side"}
          className="ct-tailor-btn-view"
          style={{
            opacity: mode === "side" ? 1 : 0.7,
            fontWeight: mode === "side" ? 700 : 500,
          }}
        >
          Lado a lado
        </button>
        <button
          type="button"
          onClick={() => setMode("unified")}
          aria-pressed={mode === "unified"}
          className="ct-tailor-btn-view"
          style={{
            opacity: mode === "unified" ? 1 : 0.7,
            fontWeight: mode === "unified" ? 700 : 500,
          }}
        >
          Unified
        </button>
        <span
          className="ct-cv-diff-legend"
          aria-label="Legenda de cores"
          style={{
            marginLeft: "auto",
            display: "flex",
            gap: 12,
            fontSize: 12,
            color: "var(--text-muted)",
            flexWrap: "wrap",
          }}
        >
          <LegendSwatch label="Adicionado" color="rgba(34,197,94,0.18)" symbol="+" />
          <LegendSwatch label="Removido" color="rgba(239,68,68,0.18)" symbol="-" />
          <LegendSwatch label="Alterado" color="rgba(234,179,8,0.18)" symbol="~" />
        </span>
      </div>

      <div
        className="ct-cv-diff-stats"
        aria-label="Resumo das mudancas"
        data-testid="diff-stats"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 10,
          marginBottom: 18,
        }}
      >
        <StatPill label="Adicionadas" value={stats.added} accent="green" />
        <StatPill label="Removidas" value={stats.removed} accent="red" />
        <StatPill label="Alteradas" value={stats.changed} accent="yellow" />
        <StatPill label="% mudou" value={`${pct}%`} accent="primary" />
      </div>

      {mode === "side" ? (
        <SideBySide rows={rows} />
      ) : (
        <Unified ops={unifiedOps} />
      )}
    </section>
  );
}

function LegendSwatch({ label, color, symbol }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: 14,
          height: 14,
          background: color,
          borderRadius: 3,
          textAlign: "center",
          lineHeight: "14px",
          fontSize: 10,
          fontWeight: 800,
          color: "var(--text)",
          fontFamily: "var(--font-mono, monospace)",
        }}
      >
        {symbol}
      </span>
      {label}
    </span>
  );
}

function StatPill({ label, value, accent }) {
  // Cores: green/red/yellow/primary, com fallback p/ var() do design system.
  const colorMap = {
    green: "rgb(22,163,74)",
    red: "rgb(220,38,38)",
    yellow: "rgb(202,138,4)",
    primary: "var(--primary, rgb(20,140,160))",
  };
  return (
    <div
      className="ct-kpi-card"
      style={{ textAlign: "left" }}
      role="group"
      aria-label={`${label}: ${value}`}
    >
      <div
        className="ct-kpi-value"
        style={{ color: colorMap[accent] || "var(--text)", fontSize: 22 }}
      >
        {value}
      </div>
      <div className="ct-kpi-label">{label}</div>
    </div>
  );
}

// --- Side-by-side render ---
//
// 2 colunas com header "Original"/"Adaptado". Cada row tem mesmo height (1 linha
// logica) garantindo alinhamento visual. Linhas insert sem `left` mostram celula
// vazia. Linhas changed renderizam diff word-level inline (riscando palavras
// removidas, marcando palavras inseridas em verde).
function SideBySide({ rows }) {
  return (
    <div
      className="ct-cv-diff-side"
      data-testid="diff-side"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 1,
        background: "var(--border)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        fontFamily: "var(--font-mono, monospace)",
        fontSize: 13,
        lineHeight: 1.55,
      }}
      role="region"
      aria-label="Diff lado a lado: original a esquerda, adaptado a direita"
    >
      <DiffHeader label="Original" side="left" />
      <DiffHeader label="Adaptado" side="right" />
      {rows.map((row, i) => (
        <SideRow key={i} row={row} index={i} />
      ))}
    </div>
  );
}

function DiffHeader({ label }) {
  return (
    <div
      style={{
        padding: "10px 14px",
        background: "var(--surface-2, #f4f4f5)",
        fontWeight: 700,
        fontSize: 12,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        borderBottom: "1px solid var(--border)",
      }}
      role="columnheader"
    >
      {label}
    </div>
  );
}

function SideRow({ row, index }) {
  const styles = rowStyles(row.type);
  const leftSymbol = row.type === "delete" ? "-" : row.type === "changed" ? "~" : " ";
  const rightSymbol = row.type === "insert" ? "+" : row.type === "changed" ? "~" : " ";

  // Render words inline pra changed (diff word-level). Caso contrario, texto plain.
  const leftContent =
    row.type === "changed" && row.words
      ? renderWords(row.words, "left")
      : row.left ?? "";
  const rightContent =
    row.type === "changed" && row.words
      ? renderWords(row.words, "right")
      : row.right ?? "";

  return (
    <>
      <div
        role="cell"
        aria-rowindex={index + 2}
        style={{
          ...styles.left,
          padding: "6px 14px",
          background: row.left == null ? "var(--surface-2, #f4f4f5)" : styles.left.background,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
        data-row-type={row.type}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: "1ch",
            marginRight: 8,
            opacity: 0.55,
            fontWeight: 700,
          }}
        >
          {leftSymbol}
        </span>
        {leftContent || <span style={{ opacity: 0.3 }}>&nbsp;</span>}
      </div>
      <div
        role="cell"
        aria-rowindex={index + 2}
        style={{
          ...styles.right,
          padding: "6px 14px",
          background: row.right == null ? "var(--surface-2, #f4f4f5)" : styles.right.background,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
        data-row-type={row.type}
      >
        <span
          aria-hidden="true"
          style={{
            display: "inline-block",
            width: "1ch",
            marginRight: 8,
            opacity: 0.55,
            fontWeight: 700,
          }}
        >
          {rightSymbol}
        </span>
        {rightContent || <span style={{ opacity: 0.3 }}>&nbsp;</span>}
      </div>
    </>
  );
}

function rowStyles(type) {
  // Cores soft 18% saturacao — passa WCAG AA com texto escuro padrao.
  if (type === "insert") {
    return {
      left: { background: "transparent" },
      right: { background: "rgba(34,197,94,0.18)" },
    };
  }
  if (type === "delete") {
    return {
      left: { background: "rgba(239,68,68,0.18)" },
      right: { background: "transparent" },
    };
  }
  if (type === "changed") {
    return {
      left: { background: "rgba(234,179,8,0.18)" },
      right: { background: "rgba(234,179,8,0.18)" },
    };
  }
  // equal
  return {
    left: { background: "var(--surface, white)" },
    right: { background: "var(--surface, white)" },
  };
}

// Renderiza diff word-level dentro de uma linha "changed".
// side="left": mostra palavras equal + palavras delete (riscadas, vermelho).
// side="right": mostra palavras equal + palavras insert (sublinhadas, verde).
function renderWords(words, side) {
  return words.map((w, i) => {
    if (w.type === "equal") {
      return (
        <span key={i}>
          {w.value}
        </span>
      );
    }
    if (w.type === "delete" && side === "left") {
      return (
        <span
          key={i}
          style={{
            background: "rgba(239,68,68,0.35)",
            textDecoration: "line-through",
            textDecorationColor: "rgba(239,68,68,0.8)",
          }}
        >
          {w.value}
        </span>
      );
    }
    if (w.type === "insert" && side === "right") {
      return (
        <span
          key={i}
          style={{
            background: "rgba(34,197,94,0.35)",
            fontWeight: 600,
          }}
        >
          {w.value}
        </span>
      );
    }
    return null;
  });
}

// --- Unified render ---
//
// 1 coluna com prefix +/- /  (espaco) por linha. Mesmo color scheme.
// Cada linha e <div> com role="row" pra navegabilidade por screen reader.
function Unified({ ops }) {
  return (
    <div
      className="ct-cv-diff-unified"
      data-testid="diff-unified"
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        fontFamily: "var(--font-mono, monospace)",
        fontSize: 13,
        lineHeight: 1.6,
        background: "var(--surface, white)",
      }}
      role="region"
      aria-label="Diff em modo unified"
    >
      {ops.map((op, i) => {
        const prefix = op.type === "insert" ? "+" : op.type === "delete" ? "-" : " ";
        const bg =
          op.type === "insert"
            ? "rgba(34,197,94,0.18)"
            : op.type === "delete"
            ? "rgba(239,68,68,0.18)"
            : "transparent";
        return (
          <div
            key={i}
            role="row"
            data-op-type={op.type}
            style={{
              padding: "4px 14px",
              background: bg,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              display: "flex",
              gap: 8,
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: "1ch",
                opacity: 0.55,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {prefix}
            </span>
            <span>{op.value || " "}</span>
          </div>
        );
      })}
    </div>
  );
}
