// Icones SVG dos 3 assessments. Pure presentation: sem state, sem props
// alem de size/className/aria. Pode ser usado tanto em server quanto client
// component (sao funcoes React puras, sem hooks).
//
// Cores nao sao hardcoded: usam currentColor (e fills internos com opacidade)
// pra herdar a cor do container (que define com var(--primary), --positive, etc).

// Matriz 2x2 — usado em DISC. Sugere os 4 quadrantes (D/I/S/C) sem precisar
// de letras, soh com a geometria.
export function IconMatrix({ size = 22, className, ariaHidden = true }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      <rect x="3" y="3" width="8" height="8" rx="1.5" fill="currentColor" fillOpacity="0.22" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" fill="currentColor" fillOpacity="0.08" />
    </svg>
  );
}

// Estrela 5 pontas — usado em VALORES (5 selecoes -> 5 pontas).
export function IconStar({ size = 22, className, ariaHidden = true }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      fillOpacity="0.18"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      className={className}
      aria-hidden={ariaHidden}
    >
      <path d="M12 3l2.5 5.6 6.1.7-4.6 4.2 1.3 6L12 16.6 6.7 19.5 8 13.5 3.4 9.3l6.1-.7L12 3z" />
    </svg>
  );
}

// 4 circulos sobrepostos — clessico diagrama Ikigai. Usa fill + opacidade pra
// dar a sensacao de intersecao sem precisar de SVG mask complexa.
export function IconCircles({ size = 22, className, ariaHidden = true }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="1.2"
      className={className}
      aria-hidden={ariaHidden}
    >
      <circle cx="9" cy="9" r="5" fillOpacity="0.16" />
      <circle cx="15" cy="9" r="5" fillOpacity="0.16" />
      <circle cx="9" cy="15" r="5" fillOpacity="0.16" />
      <circle cx="15" cy="15" r="5" fillOpacity="0.16" />
    </svg>
  );
}

// Dispatcher: recebe iconKind string e devolve o componente certo. Usado
// pelos cards da landing (que recebem `def.iconKind`).
export function AssessmentIcon({ kind, size = 22, className }) {
  if (kind === "matrix") return <IconMatrix size={size} className={className} />;
  if (kind === "star") return <IconStar size={size} className={className} />;
  if (kind === "circles") return <IconCircles size={size} className={className} />;
  return null;
}
