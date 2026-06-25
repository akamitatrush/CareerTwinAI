// Wave 10 — restaura a fonte rastreavel na UI. A citacao "[Curriculo]"/
// "[Mercado]"/"[Base de Vagas]"/"[RAG]"/"[BLS]" era STRIPADA por commit
// antigo ("ruido visual aqui") em MicroactionCard.js e RadarClient.js.
//
// Tese do produto: transparencia radical — score auditavel + microacoes
// com fonte sao o moat #1 do CareerTwin. Renderizar a fonte como chip
// pequeno preserva o moat sem virar ruido visual no card.
//
// Seguranca (seguranca-careertwin / OWASP):
//  - src e renderizado SEMPRE como texto literal (interpolacao JSX), NUNCA
//    via dangerouslySetInnerHTML. React escapa automaticamente.
//  - replace(/^\[|\]$/g, "") so remove colchetes externos — nao executa nada.
//  - title (tooltip) tambem e atributo, escapado pelo React.
//
// Acessibilidade:
//  - title fornece contexto pra mouse hover
//  - svg e aria-hidden (decorativo); o label textual carrega o significado
//  - inline-flex + verticalAlign middle = posicao correta no fluxo do <p>

export default function SrcChip({ src, title }) {
  if (!src) return null;
  // Aceita "[Curriculo]" (com colchetes) ou "Curriculo" (sem). Normaliza.
  const label = String(src).replace(/^\[|\]$/g, "").trim();
  if (!label) return null;
  return (
    <span
      className="src-chip"
      title={title || `Fonte: ${label}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        marginLeft: 8,
        padding: "2px 8px",
        fontSize: "11px",
        fontWeight: 500,
        letterSpacing: "0.02em",
        lineHeight: 1.4,
        color: "var(--text-muted, var(--text-soft))",
        background: "var(--surface-2, var(--surface))",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-sm, 6px)",
        verticalAlign: "middle",
        whiteSpace: "nowrap",
      }}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      >
        {/* Icone "fonte"/link: triangulo apontando = origem rastreavel. */}
        <path d="M9 17l6-5-6-5v10z" fill="currentColor" />
      </svg>
      {label}
    </span>
  );
}
