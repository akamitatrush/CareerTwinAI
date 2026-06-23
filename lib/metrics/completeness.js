// lib/metrics/completeness.js
// Calcula % de completude do perfil baseado em fields essenciais.
// Pesos definidos pelo impacto que cada item tem no diagnostico:
//   - rawCv (20): base do gemeo digital, sem CV nao ha analise
//   - targetRole (15) + skills (15): direcionam aderencia_vagas e relevancia_habilidades
//   - nome (10) + cargoAtual (10) + linkedinJson (10) + githubUser (10): contexto basico
//   - senioridade (5) + projectsWithMetrics (5): qualificadores adicionais
// Total = 100. Calculo em runtime (NAO persistido) pra manter o principio
// "numero = calculo deterministico" do produto.

const FIELDS = [
  { key: "nome", label: "Seu nome", weight: 10, check: (p) => !!p?.nome },
  { key: "cargoAtual", label: "Cargo atual", weight: 10, check: (p) => !!p?.cargoAtual },
  { key: "senioridade", label: "Senioridade", weight: 5, check: (p) => !!p?.senioridade },
  { key: "targetRole", label: "Cargo-alvo", weight: 15, check: (p) => !!p?.targetRole },
  {
    key: "skills",
    label: "Skills (3+)",
    weight: 15,
    check: (p) => Array.isArray(p?.skills) && p.skills.length >= 3,
  },
  {
    key: "rawCv",
    label: "Curriculo carregado",
    weight: 20,
    check: (p) => typeof p?.rawCv === "string" && p.rawCv.length >= 200,
  },
  { key: "linkedinJson", label: "Perfil do LinkedIn", weight: 10, check: (p) => !!p?.linkedinJson },
  { key: "githubUser", label: "Portfolio GitHub", weight: 10, check: (p) => !!p?.githubUser },
  {
    key: "projectsWithMetrics",
    label: "Projeto com metrica de impacto",
    weight: 5,
    check: (p) => {
      const port = p?.portfolioJson;
      if (!port?.projetos || !Array.isArray(port.projetos)) return false;
      return port.projetos.some((proj) => {
        const desc = proj?.descricao || "";
        return /\d/.test(desc) && /(%|aument|reduz|impact|metric|conv|RPS)/i.test(desc);
      });
    },
  },
];

const TOTAL_WEIGHT = FIELDS.reduce((s, f) => s + f.weight, 0);

export function computeCompleteness(profile) {
  if (!profile) {
    return {
      percent: 0,
      missing: FIELDS.map((f) => ({ key: f.key, label: f.label })),
      filled: [],
    };
  }

  const filled = FIELDS.filter((f) => f.check(profile));
  const filledWeight = filled.reduce((s, f) => s + f.weight, 0);
  const missing = FIELDS.filter((f) => !f.check(profile)).map((f) => ({
    key: f.key,
    label: f.label,
  }));

  const percent = Math.round((filledWeight / TOTAL_WEIGHT) * 100);
  return { percent, missing, filled: filled.map((f) => f.key) };
}
