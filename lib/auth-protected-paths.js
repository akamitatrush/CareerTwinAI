// Single source of truth pras rotas que exigem session.
// Importado tanto pelo middleware (CSP + auth gate em paginas) quanto pelo
// auth.config (callback `authorized` que decide redirect pra /entrar).
//
// Antes desse arquivo, middleware.js tinha PROTECTED com 2 entries enquanto
// auth.config tinha PROTECTED_PREFIXES com ~10. Drift garantido: page nova
// poderia ficar acessivel sem session se esquecermos de adicionar nos dois.

// Prefixos sao tratados com a semantica de:
//  - pathname === prefix
//  - pathname.startsWith(prefix + "/")
// (evita match incorreto tipo "/conta" matchear "/contas-publicas")
// Prefixos que terminam com "/" sao tratados como literal startsWith.
export const PROTECTED_PREFIXES = [
  // Pages (app router) — UI logada
  "/dashboard",
  "/gaps",
  "/oportunidades",
  "/concursos",
  "/estagios",
  "/funil",
  "/plano",
  // /transparencia REMOVIDO (Wave B1, 2026-06-29): pagina virou PUBLICA pra
  // permitir que o anonimo veja a formula antes de criar conta. Page foi
  // movida de app/(app)/transparencia pra app/transparencia. Dual-mode no
  // arquivo: anonimo NAO bate no DB; logado le ultimo snapshot. Disclaimer
  // LGPD continua na page. NAO recolocar aqui sem reverter a movimentacao.
  "/conta",
  "/meus-dados",
  "/meu-gemeo",
  "/candidaturas",
  "/cvs-adaptados",
  "/evidencias",
  "/autoconhecimento",
  // /admin — owner-only via OWNER_EMAILS. Page faz re-check com isOwnerEmail().
  // No middleware so basta exigir session (defense-in-depth, sem owner check aqui
  // pra evitar acoplamento; nao-owner cai num redirect /dashboard pela page).
  "/admin",
  "/api/admin/",

  // API routes — todas exigem session (cada uma re-checa `auth()` defense-in-depth)
  "/api/me/",
  "/api/billing/checkout",
  "/api/billing/portal",
  "/api/billing/plan",
  // /api/billing/webhook NAO entra — autentica via HMAC Stripe, sem session.
  "/api/assessments/",
  "/api/evidence",
  "/api/applications",
  "/api/tailored-cvs",
  "/api/notifications",
  "/api/gaps/",
  "/api/plan-items/",
  "/api/profile/",
  "/api/concursos",
  "/api/estagios",
  "/api/funnel",

  // Rotas LLM NAO entram aqui — suportam "modo experimentar" anonimo
  // (user anonimo cola CV em / e ve diagnostico efemero sem login).
  // Cada rota faz auth() interno: se logged, persiste com IDOR-safe scope;
  // se anonimo, roda efemero. Adicionar aqui quebraria o fluxo de descoberta.
  // Rate-limit (lib/rate-limit.js) protege anonimos com perMinuteAnon=3.
  //
  // Lista preservada (NAO descomentar) — referencia historica de quem foi
  // tentado bloquear e por que nao bloqueamos:
  //   /api/analyze, /api/opportunities, /api/interview, /api/tailor,
  //   /api/chat, /api/portfolio/import, /api/linkedin/parse,
  //   /api/cv/analyze-bullets
];

export function isProtected(pathname) {
  if (typeof pathname !== "string") return false;
  return PROTECTED_PREFIXES.some((p) => {
    if (p.endsWith("/")) return pathname.startsWith(p);
    return pathname === p || pathname.startsWith(p + "/");
  });
}
