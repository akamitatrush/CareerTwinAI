// Templates de daily quest — feature #10 (habit loop) do STRATEGY_ROADMAP.
//
// Lista curada por kind. O endpoint GET /api/me/daily-quest seleciona um kind
// baseado no estado do user (heuristica em pickKindForUser) e depois sorteia
// um template daquele kind via pickTemplate. Sem chamada LLM — tudo deterministico
// + random local pra evitar custo e latencia.
//
// Por que estatico (vs gerado por LLM):
//  - Custo zero por user/dia.
//  - Sem risco de prompt injection via CV (LLM01) — templates sao codigo, nao
//    saida de modelo.
//  - Previsibilidade: dev/QA conseguem testar exato.
//  - Rotacao 7-dias evita repeticao (filtra kinds completed nos ultimos 7d).

// Tabela por kind. Cada entrada e um template completo (titulo + descricao +
// estimativa de tempo + pontos). Manter sintetico — frase ativa, instrucao
// clara, tempo realista (5-15 min teto). PT-BR informal mas profissional.
export const QUEST_TEMPLATES = {
  CV_BULLET_REWRITE: [
    {
      title: "Reescreva 1 bullet do CV com número",
      description:
        "Pegue 1 bullet do seu currículo sem métrica e reescreva incluindo um número (% de melhoria, R$ economizado, X usuários impactados). Use o método CAR: Contexto, Ação, Resultado.",
      estimatedMinutes: 5,
      rewardPoints: 5,
    },
    {
      title: "Substitua 1 verbo passivo por ativo",
      description:
        "Encontre 1 bullet com verbo tipo 'auxiliei', 'participei', 'contribuí'. Substitua por 'liderei', 'reduzi', 'implementei'. Ação > passividade.",
      estimatedMinutes: 3,
      rewardPoints: 4,
    },
  ],
  LINKEDIN_HEADLINE: [
    {
      title: "Atualize seu headline do LinkedIn",
      description:
        "Use a fórmula: [Cargo atual ou desejado] | [Especialidade técnica] | [Conquista mensurável]. Ex: 'Engineering Manager | LLMs aplicados | 3x growth em produto fintech'.",
      estimatedMinutes: 5,
      rewardPoints: 5,
    },
  ],
  EVIDENCE_ADD: [
    {
      title: "Documente 1 evidência de competência",
      description:
        "Adicione 1 projeto, case ou certificação em /evidencias com métrica de impacto. Quanto mais específico (com número + skill + período), mais convincente.",
      estimatedMinutes: 10,
      rewardPoints: 10,
    },
  ],
  SKILL_RESEARCH: [
    {
      title: "Pesquise 1 skill emergente da sua área",
      description:
        "Identifique 1 skill que está bombando nas vagas do seu cargo-alvo nos últimos 3 meses (LinkedIn, blogs, Reddit) e tome nota de como aprender.",
      estimatedMinutes: 15,
      rewardPoints: 8,
    },
  ],
  INTERVIEW_PREP: [
    {
      title: "Pratique 1 pergunta STAR no /interview",
      description:
        "Abra a simulação de entrevista e responda 1 pergunta comportamental usando o método STAR (Situação, Tarefa, Ação, Resultado).",
      estimatedMinutes: 10,
      rewardPoints: 10,
    },
  ],
  NETWORK_OUTREACH: [
    {
      title: "Conecte-se com 1 profissional da área",
      description:
        "Mande conexão no LinkedIn com mensagem personalizada (não copy-paste) pra 1 profissional que atua no cargo-alvo. Mencione algo do perfil dele.",
      estimatedMinutes: 8,
      rewardPoints: 7,
    },
  ],
  MARKET_RESEARCH: [
    {
      title: "Leia 1 vaga do cargo-alvo até o fim",
      description:
        "Abra /oportunidades e leia 1 descrição completa. Anote 3 requisitos que aparecem (vão entrar nos seus gaps depois).",
      estimatedMinutes: 5,
      rewardPoints: 4,
    },
  ],
  REFLECTION: [
    {
      title: "Reflita: por que esse cargo?",
      description:
        "Escreva 3 frases sobre POR QUE você quer o cargo-alvo. Não é o salário — é o problema que você quer resolver. Salve em uma nota — vai usar em entrevista.",
      estimatedMinutes: 5,
      rewardPoints: 5,
    },
  ],
};

// Lista de kinds validos (allow-list). Usada pra defesa-em-profundidade quando
// pickKindForUser retorna algo (impede que kind invalido escape pra Prisma e
// quebre o create com enum nao reconhecido).
export const QUEST_KINDS = Object.keys(QUEST_TEMPLATES);

/**
 * Sorteia um template da lista do kind dado. Retorna null se kind invalido
 * ou lista vazia (defesa: nunca explode no caller).
 *
 * @param {string} kind QuestKind enum value
 * @returns {{title:string, description:string, estimatedMinutes:number, rewardPoints:number} | null}
 */
export function pickTemplate(kind) {
  const list = QUEST_TEMPLATES[kind];
  if (!list || list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Heuristica de selecao de kind baseada no estado do user. Prioriza areas onde
 * o user AINDA NAO fez progresso visivel (sem evidence, sem linkedin, score baixo)
 * e rotaciona "fillers" pra evitar repeticao. Filtra kinds completed nos ultimos
 * 7 dias (a partir de completedQuests, que ja vem ordenado desc por completedAt).
 *
 * @param {Object} state
 * @param {boolean} [state.hasCv] user tem CV importado?
 * @param {boolean} [state.hasLinkedin] user tem linkedin importado?
 * @param {boolean} [state.hasEvidence] user tem ao menos 1 evidence?
 * @param {boolean} [state.hasAssessment] user fez algum assessment?
 * @param {Array<{kind:string}>} [state.completedQuests] quests recentes (desc por completedAt)
 * @param {number|null} [state.latestScore] ultimo score overall (0-100)
 * @returns {string} kind escolhido (sempre valido — fallback "REFLECTION")
 */
export function pickKindForUser({
  hasCv = false,
  hasLinkedin = false,
  hasEvidence = false,
  hasAssessment = false,
  completedQuests = [],
  latestScore = null,
} = {}) {
  const candidates = [];

  // Prioridade alta: areas vazias do gemeo
  if (!hasEvidence) candidates.push("EVIDENCE_ADD");
  if (!hasLinkedin) candidates.push("LINKEDIN_HEADLINE");
  if (latestScore && latestScore < 60) {
    candidates.push("CV_BULLET_REWRITE", "MARKET_RESEARCH");
  }

  // Fillers — sempre presentes pra rotacao
  candidates.push(
    "SKILL_RESEARCH",
    "INTERVIEW_PREP",
    "NETWORK_OUTREACH",
    "REFLECTION",
  );

  // Filtro: kinds completed nos ultimos 7d (evita "ja fiz essa essa semana").
  // completedQuests vem ordenado desc por completedAt; pegamos top 7 entradas.
  const recentKinds = new Set(
    (Array.isArray(completedQuests) ? completedQuests : [])
      .slice(0, 7)
      .map((q) => q?.kind)
      .filter(Boolean),
  );
  const fresh = candidates.filter((k) => !recentKinds.has(k));

  // Se todas as candidatas ja foram feitas, usa a primeira (re-rotaciona).
  // Garante que SEMPRE retorna algo valido em QUEST_KINDS.
  const list = fresh.length > 0 ? fresh : candidates;
  const picked = list[Math.floor(Math.random() * list.length)];
  // Defesa: se algum bug fizer kind cair fora do allow-list, volta pra REFLECTION
  // (sempre tem template e e seguro).
  if (!QUEST_KINDS.includes(picked)) return "REFLECTION";
  return picked;
}
