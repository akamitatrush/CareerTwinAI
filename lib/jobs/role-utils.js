// Tokens "ruido" que NAO devem ser usados pra discriminar vaga por cargo.
// Inclui:
//   - senioridades (junior/pleno/senior/lead/...) — vaga "Analista Pleno"
//     compartilha o token "pleno" com "Designer Pleno", "Backend Pleno",
//     etc. Usar "pleno" como sinal de match e equivalente a desligar o filtro.
//   - cargos genericos (manager/gerente/especialista) — idem.
//   - stop-words PT/EN (de/da/do/para/em/com/the/of/and/or).
//
// Consumidores:
//   - `lib/jobs/index.js::relaxRole` — strip antes de chamar providers reais
//     (Adzuna/Jooble matcheiam exato; menos tokens = mais recall).
//   - `lib/jobs/providers/fixtures.js::searchFixtures` — filtra `targetTokens`
//     usados em `titHit` pra evitar substring-bug (Apendice C do report Data
//     2026-06-30: "pleno" batia ~25 fixtures de verticais aleatorias).
//
// IMPORTANTE: todos os tokens aqui estao normalizados (lower, sem acento).
// Quem consome PRECISA normalizar antes de checar `NOISE_TOKENS.has(t)`.
export const NOISE_TOKENS = new Set([
  "junior", "jr", "trainee", "pleno", "mid", "senior", "sr", "lead",
  "principal", "staff", "especialista", "especialist", "manager", "gerente",
  "de", "da", "do", "para", "em", "com", "the", "of", "and", "or",
]);
