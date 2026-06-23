// Roadmaps curados pra cargos comuns. Cada cargo tem 3-5 milestones
// pra atingir senioridade target. Templates deterministicos — versao
// futura usaria LLM pra customizar baseado em estado atual do user.
//
// Por que deterministico no MVP: os templates aqui sao opinionados
// (curadoria humana), o que ja entrega valor sem custo de LLM. A
// pagina /carreira cruza as skills do Profile do usuario com cada
// milestone pra mostrar progresso real (sem inventar nada).
//
// Convencao: keys sao slugs lowercase. Skills tambem lowercase pra
// bater com o set derivado de Profile.skills no SSR.

export const CAREER_PATHS = {
  "product owner ai": {
    targetTitle: "Product Owner AI Senior",
    timeline: "12-18 meses",
    milestones: [
      {
        order: 1,
        title: "Fundamentos de Product Ownership",
        durationWeeks: 8,
        skills: ["scrum", "backlog management", "user stories", "roadmap"],
        actions: [
          "Certificacao PSPO I (Scrum.org, ~30h estudo, R$ 770)",
          "Conclua modulo Discovery da imersao Tera",
          "Documente mini-roadmap pra projeto pessoal",
        ],
        evidence: "Adicione PSPO + 1 projeto com roadmap em /evidencias",
      },
      {
        order: 2,
        title: "Metricas de produto + Discovery",
        durationWeeks: 10,
        skills: ["okr", "kpi", "discovery", "user research", "ab testing"],
        actions: [
          "Curso 'Product Discovery' (ProductCademy ou Tera)",
          "Entreviste 5 usuarios reais (mesmo de projeto pessoal)",
          "Defina north star + metricas piramide pra 1 produto",
        ],
        evidence: "Case de discovery com hipoteses validadas em /evidencias",
      },
      {
        order: 3,
        title: "IA aplicada a produto",
        durationWeeks: 12,
        skills: ["llm", "rag", "embeddings", "prompt engineering", "evals"],
        actions: [
          "Curso AI Engineering (Deeplearning.AI Andrew Ng — gratis)",
          "Implemente 1 feature LLM no projeto pessoal com evals",
          "Estude lancamentos da OpenAI/Anthropic 2-3x por semana",
        ],
        evidence: "Projeto AI com RAG + evals publicos em /evidencias",
      },
      {
        order: 4,
        title: "Estrategia + stakeholders",
        durationWeeks: 8,
        skills: ["strategic thinking", "stakeholder management", "business case"],
        actions: [
          "Curso 'Strategic Product Management' (Reforge / Pragmatic)",
          "Apresente projeto pra mentor senior de produto",
          "Escreva business case com ROI calculado",
        ],
        evidence: "1 business case + 1 apresentacao documentada",
      },
      {
        order: 5,
        title: "Posicionamento + entrevistas",
        durationWeeks: 6,
        skills: ["positioning", "interviewing", "negotiation"],
        actions: [
          "Reescreva LinkedIn + CV com narrativa de PO AI",
          "Mock interview no /interview (10+ sessoes)",
          "Aplique pra 30+ vagas com adaptacao por vaga",
        ],
        evidence: "Headline LinkedIn atualizado + 5+ candidaturas no /candidaturas",
      },
    ],
  },

  "engenheiro backend senior": {
    targetTitle: "Engenheiro Backend Senior",
    timeline: "12-15 meses",
    milestones: [
      {
        order: 1,
        title: "Arquitetura de sistemas",
        durationWeeks: 10,
        skills: ["system design", "microservices", "distributed systems", "messaging"],
        actions: [
          "Livro 'Designing Data-Intensive Applications' (Kleppmann)",
          "Curso System Design (educative.io ou ByteByteGo)",
          "Implemente 1 sistema com 3+ servicos + messaging",
        ],
        evidence: "Repo publico com arquitetura documentada",
      },
      {
        order: 2,
        title: "Performance + observabilidade",
        durationWeeks: 8,
        skills: ["profiling", "tracing", "metrics", "load testing", "postgres tuning"],
        actions: [
          "Implemente OpenTelemetry em projeto pessoal",
          "Configure Grafana + Prometheus locais",
          "Faca 1 estudo de caso de otimizacao (antes/depois com metrica)",
        ],
        evidence: "Case de otimizacao com graficos antes/depois",
      },
      {
        order: 3,
        title: "Cloud + DevOps avancado",
        durationWeeks: 12,
        skills: ["aws", "kubernetes", "terraform", "ci/cd", "security"],
        actions: [
          "Certificacao AWS Solutions Architect Associate (~80h estudo)",
          "Deploy projeto pessoal em K8s com IaC",
          "Configure CI/CD com testes + canary + rollback",
        ],
        evidence: "AWS cert + repo IaC + pipeline funcional",
      },
      {
        order: 4,
        title: "Lideranca tecnica",
        durationWeeks: 8,
        skills: ["code review", "mentoring", "tech writing", "rfcs"],
        actions: [
          "Escreva 3+ RFCs pro time atual (proposta + decisao)",
          "Mentore 1-2 juniores formalmente",
          "Faca PR review constructive (estudo: kentcdodds book)",
        ],
        evidence: "RFCs publicadas + feedback de mentoria",
      },
      {
        order: 5,
        title: "Posicionamento senior",
        durationWeeks: 6,
        skills: ["interviewing", "negotiation", "personal brand"],
        actions: [
          "Reescreva CV com narrativa de impacto senior",
          "Talk em meetup local sobre 1 case tecnico",
          "Aplique pra 20+ vagas Sr com adaptacao",
        ],
        evidence: "Talk gravado + LinkedIn atualizado",
      },
    ],
  },

  "tech lead": {
    targetTitle: "Tech Lead",
    timeline: "12-18 meses",
    milestones: [
      {
        order: 1,
        title: "Decisao tecnica + RFCs",
        durationWeeks: 8,
        skills: ["system design", "rfcs", "tech writing", "trade-off analysis"],
        actions: [
          "Escreva 3 RFCs reais pro time (alternativas + decisao)",
          "Estude 'Software Engineering at Google' (cap. 1-7)",
          "Lidere 1 ADR (Architecture Decision Record)",
        ],
        evidence: "3 RFCs publicas + 1 ADR aprovada em /evidencias",
      },
      {
        order: 2,
        title: "Lideranca tecnica de time",
        durationWeeks: 10,
        skills: ["mentoring", "code review", "1:1s", "delegation"],
        actions: [
          "Mentore 2 devs juniores formalmente (1:1 quinzenal)",
          "Configure padrao de code review pro time",
          "Conduza 1 retro tecnica com plano de acao",
        ],
        evidence: "Feedback de mentoria + retro com follow-up",
      },
      {
        order: 3,
        title: "Roadmap + planejamento",
        durationWeeks: 8,
        skills: ["roadmap", "estimation", "okr", "stakeholder management"],
        actions: [
          "Conduza planning de 1 trimestre com OKR tecnico",
          "Defina roadmap tecnico de 6 meses (debt + features)",
          "Apresente trade-offs pra PM e diretoria",
        ],
        evidence: "Roadmap publicado + OKR fechado com resultado",
      },
      {
        order: 4,
        title: "Cultura + processo",
        durationWeeks: 6,
        skills: ["incident management", "post-mortem", "engineering culture"],
        actions: [
          "Lidere 1 post-mortem real sem blame",
          "Defina runbook de on-call pro time",
          "Implemente metrica de DORA (lead time, MTTR)",
        ],
        evidence: "Post-mortem + runbook + dashboard DORA",
      },
    ],
  },

  "data scientist": {
    targetTitle: "Data Scientist Senior",
    timeline: "12-18 meses",
    milestones: [
      {
        order: 1,
        title: "Estatistica + modelagem",
        durationWeeks: 10,
        skills: ["statistics", "regression", "classification", "hypothesis testing"],
        actions: [
          "Curso 'Statistical Learning' (Hastie & Tibshirani, Stanford)",
          "Reimplement regressao e classification do zero (numpy)",
          "1 projeto Kaggle com analise estatistica documentada",
        ],
        evidence: "Notebook publico com modelos + diagnosticos",
      },
      {
        order: 2,
        title: "ML em producao",
        durationWeeks: 10,
        skills: ["mlops", "model serving", "feature stores", "monitoring", "ab testing"],
        actions: [
          "Curso 'MLOps' (Made With ML, Goku Mohandas)",
          "Suba 1 modelo em producao (Docker + FastAPI + monitoring)",
          "Implemente A/B test framework com analise estatistica",
        ],
        evidence: "Modelo servindo trafego real + dashboard de drift",
      },
      {
        order: 3,
        title: "Deep learning + LLMs",
        durationWeeks: 12,
        skills: ["deep learning", "pytorch", "transformers", "llm fine-tuning"],
        actions: [
          "Curso 'Practical Deep Learning' (fast.ai, gratis)",
          "Fine-tune 1 modelo HuggingFace pra task especifica",
          "Implemente RAG com embeddings + retrieval ranking",
        ],
        evidence: "Repo com fine-tuning + RAG documentados",
      },
      {
        order: 4,
        title: "Comunicacao + impacto",
        durationWeeks: 6,
        skills: ["storytelling", "data visualization", "business acumen"],
        actions: [
          "Apresente 1 analise pra stakeholders nao-tecnicos",
          "Curso 'Storytelling with Data' (Cole Knaflic)",
          "Escreva 3 posts tecnicos com insights de negocio",
        ],
        evidence: "1 deck + 3 posts + 1 metrica de impacto",
      },
    ],
  },

  "product designer senior": {
    targetTitle: "Product Designer Senior",
    timeline: "12-15 meses",
    milestones: [
      {
        order: 1,
        title: "Design systems + craft",
        durationWeeks: 8,
        skills: ["design systems", "figma", "components", "typography", "color"],
        actions: [
          "Contribua pra 1 design system real (open-source ou empresa)",
          "Estude 'Refactoring UI' (Steve Schoger)",
          "Documente componentes com tokens + variants no Figma",
        ],
        evidence: "Componentes publicados + documentacao de tokens",
      },
      {
        order: 2,
        title: "Discovery + research",
        durationWeeks: 10,
        skills: ["user research", "interviews", "usability testing", "personas"],
        actions: [
          "Conduza 10 entrevistas com usuarios reais (gravadas)",
          "Curso 'Just Enough Research' (Erika Hall)",
          "Faca 5 testes de usabilidade com 5+ participantes",
        ],
        evidence: "Relatorio de research com insights priorizados",
      },
      {
        order: 3,
        title: "Estrategia + business",
        durationWeeks: 8,
        skills: ["product strategy", "okr", "business case", "metrics"],
        actions: [
          "Ligue 3 decisoes de design a metricas de negocio",
          "Curso 'Strategy by Design' (Reforge)",
          "Escreva business case pra 1 redesign com ROI estimado",
        ],
        evidence: "Case com antes/depois + metrica movida",
      },
      {
        order: 4,
        title: "Lideranca + mentoria",
        durationWeeks: 8,
        skills: ["design critique", "mentoring", "stakeholder management"],
        actions: [
          "Lidere 2+ critiques semanais com framework claro",
          "Mentore 1-2 designers juniores formalmente",
          "Apresente design review pra C-level com decisao",
        ],
        evidence: "Critiques registradas + feedback de mentoria",
      },
      {
        order: 5,
        title: "Posicionamento senior",
        durationWeeks: 6,
        skills: ["portfolio", "interviewing", "personal brand"],
        actions: [
          "Reescreva portfolio com 3 cases profundos (problema/decisao/impacto)",
          "Mock interview de design (10+ sessoes)",
          "Aplique pra 15+ vagas Sr com cases adaptados",
        ],
        evidence: "Portfolio publico + 5+ candidaturas no /candidaturas",
      },
    ],
  },
};

// Lookup tolerante: tenta key exata (lowercase trim) e depois substring.
// Sem regex pra evitar ReDoS sobre input do usuario (targetRole vem do
// Profile e ja foi validado na escrita, mas defesa em profundidade).
export function getCareerPath(role) {
  if (!role || typeof role !== "string") return null;
  const normalized = role.toLowerCase().trim();
  if (!normalized) return null;
  if (CAREER_PATHS[normalized]) return CAREER_PATHS[normalized];

  for (const key of Object.keys(CAREER_PATHS)) {
    if (normalized.includes(key)) return CAREER_PATHS[key];
  }

  return null;
}

// Lista todos os paths disponiveis (pro empty state quando nao bateu).
// Read-only: nao expoe estrutura interna dos milestones aqui.
export function getAllPaths() {
  return Object.entries(CAREER_PATHS).map(([key, value]) => ({
    key,
    title: value.targetTitle,
    timeline: value.timeline,
    milestonesCount: value.milestones.length,
  }));
}
