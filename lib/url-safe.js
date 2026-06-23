// Sanitizador de URL pra render. Mesma logica do safeExternalUrl validator,
// mas no client/server pra defesa em camada quando dado vem do DB.
// Defense-in-depth: validator ja bloqueia javascript:/data:/file:/vbscript:
// na entrada, mas dados antigos no DB ou bypass futuro nao furam o render.

const SAFE_SCHEMES = new Set(["http:", "https:"]);

/**
 * Retorna URL safe pra usar em href. Se URL invalida ou scheme perigoso,
 * retorna null (caller decide se mostra link ou nao).
 */
export function safeHref(url) {
  if (!url || typeof url !== "string") return null;
  try {
    const u = new URL(url);
    return SAFE_SCHEMES.has(u.protocol) ? url : null;
  } catch {
    return null;
  }
}
