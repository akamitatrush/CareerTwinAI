import Link from "next/link";

// AlgorithmDisclaimer — microcopy LGPD Art. 20 (direito a revisao de decisao
// automatizada) + Art. 6 (transparencia algoritmica). Aparece em toda tela
// que mostra score gerado por algoritmo deterministico.
//
// Decisao 2026-06-30 (parecer PO PhD Career Sciences, secao D2):
// "Score calculado por algoritmo deterministico • Ver formula • Pedir revisao
// humana" — defesa Art. 20 em 1 linha.
//
// "Pedir revisao humana" ainda nao tem rota /revisao (criar em wave futura).
// Por ora, links ambos pra /transparencia que explica algoritmo + tem CTA
// de contato.

export default function AlgorithmDisclaimer({ variant = "default" }) {
  const baseStyle = {
    margin: variant === "compact" ? "8px 0" : "16px 0 24px",
    padding: "10px 14px",
    fontFamily: "var(--mono, 'JetBrains Mono', monospace)",
    fontSize: variant === "compact" ? "10.5px" : "11px",
    letterSpacing: "0.04em",
    color: "var(--text-faint, var(--text-muted, #888))",
    background: variant === "default" ? "var(--surface, rgba(255,255,255,0.02))" : "transparent",
    border: variant === "default" ? "1px solid var(--border, rgba(255,255,255,0.06))" : "none",
    borderRadius: "var(--radius-sm, 6px)",
    lineHeight: 1.5,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  };

  const linkStyle = {
    color: "var(--text-soft, var(--text-muted, #aaa))",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
    textDecorationColor: "var(--border-strong, rgba(255,255,255,0.15))",
  };

  return (
    <p
      className="ct-algorithm-disclaimer"
      role="note"
      aria-label="Informação sobre o algoritmo"
      style={baseStyle}
    >
      <span aria-hidden="true" style={{ opacity: 0.7 }}>ⓘ</span>
      <span>
        Score calculado por algoritmo determinístico.{" "}
        <Link href="/transparencia" style={linkStyle}>
          Ver fórmula completa
        </Link>
        {" • "}
        <Link href="/transparencia#revisao" style={linkStyle}>
          Pedir revisão humana
        </Link>
      </span>
    </p>
  );
}
