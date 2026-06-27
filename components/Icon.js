// Icon — wrapper unificado pros SVGs do produto.
//
// Por que existe: auditoria visual identificou ~180 SVGs inline espalhados
// no app com 8+ stroke-widths distintos (1, 1.2, 1.5, 1.6, 1.8, 2, 2.4, 9).
// Sem padrao = visual inconsistente + markup duplicado. Este wrapper:
//   - centraliza paths (1 fonte da verdade por glyph)
//   - oferece API canonica: name + size (4px scale) + stroke (3 widths)
//   - usa currentColor pra herdar tema (var(--text), var(--primary), etc)
//   - aria-hidden por default — clicaveis devem envolver em <button aria-label>
//
// Server Component-friendly: zero "use client", zero hooks, zero state.
// Pode renderizar em SSR e em RSC sem hydration extra.
//
// API:
//   <Icon name="arrow-right" />                    // 16x16, stroke 1.5
//   <Icon name="check" size={20} stroke={2} />
//   <Icon name="bell" className="my-nav-icon" />
//
// Sizes canonicos (4px scale): 12 / 16 / 20 / 24.
// Strokes canonicos: 1 (sutil) / 1.5 (default) / 2 (forte).
// ViewBox unificado: 0 0 24 24 — todos os paths assumem essa caixa.
//
// Quando adicionar um ícone novo: prefira reutilizar um existente. Se for
// genuinamente novo, normalize pro viewBox 24x24, use currentColor (nao
// fixe cor) e prefira paths simples (1 ou 2 <path>) — strokeLinecap=round
// e o conjunto canônico do produto.

const ICONS = {
  // --- direcionais ---
  "arrow-right": <path d="M5 12h14M13 6l6 6-6 6" />,
  "arrow-left": <path d="M19 12H5M11 6l-6 6 6 6" />,
  "arrow-up": <path d="M5 12l7-7 7 7M12 5v14" />,
  "arrow-down": <path d="M19 12l-7 7-7-7M12 19V5" />,
  "chevron-down": <path d="M6 9l6 6 6-6" />,
  "chevron-right": <path d="M9 7l6 5-6 5" />,

  // --- acao / estado ---
  "check": <path d="M5 12l5 5 9-11" />,
  "x": <path d="M6 6l12 12M6 18L18 6" />,
  "plus": <path d="M12 5v14M5 12h14" />,
  "minus": <path d="M5 12h14" />,

  // --- comunicacao / dados ---
  "bell": (
    <>
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 01-3.4 0" />
    </>
  ),
  "search": <path d="M21 21l-6-6M10 17a7 7 0 110-14 7 7 0 010 14z" />,
  "send": <path d="M5 12l7-7 7 7M12 5v14" />,
  "chat": <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  // chat-round: bolha redonda com cauda (FAB do copilot). Diferente do
  // "chat" retangular acima.
  "chat-round": (
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  ),
  "mic": (
    <>
      <path d="M12 2a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v4" />
    </>
  ),

  // --- security / status ---
  "shield": <path d="M12 2l8 4v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6z" />,
  "clock": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),

  // --- AppShell nav (cada item tem um glyph dedicado, server-rendered) ---
  "nav-home": <path d="M3 12l9-9 9 9M5 10v10h14V10" />,
  "nav-chart": <path d="M3 3l3 12 4-8 4 6 7-13" />,
  "nav-radar": <path d="M21 21l-6-6M10 17a7 7 0 110-14 7 7 0 010 14z" />,
  "nav-star": <path d="M12 2l3 7h7l-5.5 4.5 2 7.5L12 17l-6.5 4 2-7.5L2 9h7z" />,
  "nav-briefcase": <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2M3 7h18l-1 13H4z" />,
  "nav-funnel": <path d="M3 5h18l-7 9v6l-4-2v-4z" />,
  "nav-trend-up": <path d="M3 17l6-6 4 4 8-8M14 7h7v7" />,
  "nav-checklist": <path d="M9 11l3 3 8-8M21 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />,
  "nav-shield": <path d="M12 2l8 4v6c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6z" />,
  "nav-user": <path d="M12 12c2.2 0 4-1.8 4-4s-1.8-4-4-4-4 1.8-4 4 1.8 4 4 4zm0 2c-3 0-9 1.5-9 4.5V21h18v-2.5c0-3-6-4.5-9-4.5z" />,
  "nav-doc": <path d="M14 3v5h5M14 3H6v18h12V8z" />,
  "nav-folder": <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />,

  // --- decorativos filled (use prop filled) ---
  // play-triangle: usado em SrcChip pra sinalizar "fonte/origem". Filled.
  "play": <path d="M9 17l6-5-6-5v10z" />,

  // --- ThemeToggle: dot/sol/lua. dot e filled (stroke=none + fill via prop) ---
  "theme-dot": <circle cx="12" cy="12" r="8" />,
  "theme-sun": (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </>
  ),
  "theme-moon": <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />,
};

// Lista publica de nomes — util pra autocomplete e checagem em testes futuros.
// Mantida em sync manual (forEach do objeto resolve em runtime mas perde DX).
// Quando crescer muito (>30) considerar mover pra um lib/icons-meta.js.
export const ICON_NAMES = Object.freeze(Object.keys(ICONS));

/**
 * <Icon name="..." size={16} stroke={1.5} className="..." />
 *
 * - name: nome do glyph (ver ICON_NAMES). Default fallback = null.
 * - size: 12 | 16 | 20 | 24 (default 16). Aplica width=height=size.
 * - stroke: 1 | 1.5 | 2 (default 1.5). currentColor sempre.
 * - className: passthrough pro <svg>. Use pra cor (color: var(--primary))
 *   ou para classes de animacao (ex.: ct-icon-spin).
 * - filled: se true, glyph usa fill="currentColor" e stroke=none (pra
 *   ícones intencionalmente preenchidos: theme-dot, play, etc).
 * - ...rest: outros atributos SVG sao passthrough (ex.: role, focusable).
 */
export default function Icon({
  name,
  size = 16,
  stroke = 1.5,
  className,
  filled = false,
  ...rest
}) {
  const icon = ICONS[name];
  if (!icon) {
    // Dev: warn ajuda a pegar typo cedo. Prod: render null pra nao quebrar
    // build/UX por causa de um glyph faltando (defensivo).
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(`Icon: nome "${name}" desconhecido. Disponiveis: ${ICON_NAMES.join(", ")}`);
    }
    return null;
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={filled ? undefined : stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {icon}
    </svg>
  );
}
