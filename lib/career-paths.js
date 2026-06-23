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

  "engineering manager": {
    targetTitle: "Engineering Manager",
    timeline: "12-15 meses",
    milestones: [
      {
        order: 1,
        title: "Fundamentos de people management",
        durationWeeks: 8,
        skills: ["1:1s", "feedback", "coaching", "performance management"],
        actions: [
          "Livro 'The Making of a Manager' (Julie Zhuo)",
          "Estabeleca framework de 1:1 quinzenal com 3-5 pessoas",
          "Pratique feedback SBI em 5+ situacoes reais",
        ],
        evidence: "Notas de 1:1 (anonimizadas) + 1 ciclo de feedback documentado",
      },
      {
        order: 2,
        title: "Delegacao + execucao do time",
        durationWeeks: 10,
        skills: ["delegation", "estimation", "planning", "risk management"],
        actions: [
          "Livro 'High Output Management' (Andy Grove)",
          "Lidere 1 projeto trimestral com 3+ ICs sem codar voce mesmo",
          "Defina metricas de saude do time (velocity, churn, NPS interno)",
        ],
        evidence: "Projeto entregue + dashboard de health do time",
      },
      {
        order: 3,
        title: "Estrategia + politica organizacional",
        durationWeeks: 8,
        skills: ["strategic thinking", "stakeholder management", "org design"],
        actions: [
          "Curso 'Engineering Management' (Plato ou LeadDev)",
          "Apresente OKR trimestral pra diretoria com trade-offs",
          "Mapeie stakeholders + influencias num org chart real",
        ],
        evidence: "Plano trimestral aprovado + mapa de stakeholders",
      },
      {
        order: 4,
        title: "Cultura + hiring",
        durationWeeks: 8,
        skills: ["hiring", "interviewing", "engineering culture", "diversity"],
        actions: [
          "Conduza 5+ entrevistas tecnicas + comportamentais como hiring manager",
          "Escreva job description + rubric pra 1 vaga real",
          "Defina valores do time + ritual de reconhecimento",
        ],
        evidence: "1 contratacao fechada + documento de cultura do time",
      },
      {
        order: 5,
        title: "Transicao + posicionamento",
        durationWeeks: 6,
        skills: ["interviewing", "personal brand", "negotiation"],
        actions: [
          "Reescreva LinkedIn com narrativa de impacto via time",
          "Mock interview behavioral STAR (10+ sessoes)",
          "Aplique pra 15+ vagas EM com cases de lideranca",
        ],
        evidence: "5+ candidaturas EM + 1 talk sobre lideranca tecnica",
      },
    ],
  },

  "staff engineer": {
    targetTitle: "Staff Engineer",
    timeline: "15-18 meses",
    milestones: [
      {
        order: 1,
        title: "Visao de arquitetura",
        durationWeeks: 12,
        skills: ["system design", "architecture", "trade-off analysis", "tech radar"],
        actions: [
          "Livro 'Staff Engineer' (Will Larson)",
          "Escreva 3 ADRs sobre escolhas arquiteturais grandes",
          "Construa tech radar do time com proposta de evolucao 1-2 anos",
        ],
        evidence: "3 ADRs aprovadas + tech radar publicado internamente",
      },
      {
        order: 2,
        title: "Lideranca tecnica sem autoridade",
        durationWeeks: 10,
        skills: ["technical leadership", "rfcs", "mentoring", "code review"],
        actions: [
          "Lidere 1 iniciativa cross-team via RFC (sem reportar autoridade)",
          "Mentore 3+ Srs formalmente em decisoes arquiteturais",
          "Estabeleca padrao de RFC + ritual de revisao no time",
        ],
        evidence: "RFC cross-team aprovada + 3 mentorias com feedback",
      },
      {
        order: 3,
        title: "Influencia cross-team + estrategia",
        durationWeeks: 10,
        skills: ["cross-team collaboration", "strategic thinking", "tech writing"],
        actions: [
          "Lidere working group com engenheiros de 2+ times",
          "Apresente proposta tecnica pra VP/CTO com decisao",
          "Publique 3 documentos internos de estrategia tecnica",
        ],
        evidence: "Working group entregue + 1 decisao C-level documentada",
      },
      {
        order: 4,
        title: "Impacto + escala de conhecimento",
        durationWeeks: 8,
        skills: ["tech writing", "public speaking", "open source"],
        actions: [
          "Talk em conferencia (interna ou externa) sobre case tecnico",
          "Contribua pra 1 projeto open-source de infra/framework",
          "Escreva 3+ posts tecnicos publicos com 500+ views",
        ],
        evidence: "Talk gravado + PR aceita em OSS + posts publicos",
      },
      {
        order: 5,
        title: "Posicionamento Staff",
        durationWeeks: 6,
        skills: ["interviewing", "system design", "personal brand"],
        actions: [
          "Pratique system design interviews (Hello Interview, 15+ sessoes)",
          "Reescreva CV com narrativa de impacto multi-team",
          "Aplique pra 10+ vagas Staff com casos arquiteturais",
        ],
        evidence: "5+ candidaturas Staff + 1 oferta ou final round",
      },
    ],
  },

  "product manager senior": {
    targetTitle: "Product Manager Senior",
    timeline: "12-15 meses",
    milestones: [
      {
        order: 1,
        title: "Discovery profundo + research",
        durationWeeks: 10,
        skills: ["discovery", "user research", "interviews", "jobs to be done"],
        actions: [
          "Livro 'Continuous Discovery Habits' (Teresa Torres)",
          "Conduza 15+ entrevistas com usuarios em 1 trimestre",
          "Mapeie opportunity solution tree pra 1 problema real",
        ],
        evidence: "Opportunity tree + 15 entrevistas sintetizadas em /evidencias",
      },
      {
        order: 2,
        title: "Estrategia + visao de produto",
        durationWeeks: 8,
        skills: ["product strategy", "vision", "positioning", "market analysis"],
        actions: [
          "Curso 'Product Strategy' (Reforge ou Pragmatic)",
          "Escreva visao de produto 3 anos com narrativa + estrategia",
          "Faca analise competitiva detalhada de 5+ players",
        ],
        evidence: "Documento de visao aprovado + analise competitiva",
      },
      {
        order: 3,
        title: "Stakeholders + influencia",
        durationWeeks: 8,
        skills: ["stakeholder management", "communication", "negotiation"],
        actions: [
          "Conduza review mensal com C-level com decisao em 3 ocasioes",
          "Lidere 1 trade-off dificil com 3+ areas (jur, ops, eng)",
          "Escreva 3+ memos de decisao no estilo Amazon (6-pager)",
        ],
        evidence: "3 memos + 1 decisao escalada documentada",
      },
      {
        order: 4,
        title: "Metricas + experimentacao",
        durationWeeks: 8,
        skills: ["ab testing", "north star", "funnel analysis", "cohort analysis"],
        actions: [
          "Defina north star + arvore de metricas pra 1 produto real",
          "Rode 3+ A/B tests com analise estatistica rigorosa",
          "Curso 'Measuring What Matters' (John Doerr OKR + Reforge)",
        ],
        evidence: "3 experimentos com resultado + dashboard north star",
      },
      {
        order: 5,
        title: "Posicionamento Sr",
        durationWeeks: 6,
        skills: ["interviewing", "case studies", "personal brand"],
        actions: [
          "Prepare 5 cases STAR profundos pra PM interviews",
          "Mock product sense + execution (Exponent, 10+ sessoes)",
          "Aplique pra 15+ vagas PM Sr com adaptacao por empresa",
        ],
        evidence: "5+ candidaturas PM Sr + 1 final round",
      },
    ],
  },

  "frontend engineer senior": {
    targetTitle: "Frontend Engineer Senior",
    timeline: "10-12 meses",
    milestones: [
      {
        order: 1,
        title: "Performance + Core Web Vitals",
        durationWeeks: 8,
        skills: ["performance", "core web vitals", "lighthouse", "profiling"],
        actions: [
          "Curso 'Web Performance' (Frontend Masters, Steve Kinney)",
          "Otimize 1 app real pra LCP < 2.5s + CLS < 0.1 + INP < 200ms",
          "Documente case com antes/depois usando WebPageTest",
        ],
        evidence: "Case publico de otimizacao com metricas reais",
      },
      {
        order: 2,
        title: "Arquitetura frontend",
        durationWeeks: 10,
        skills: ["architecture", "monorepo", "module federation", "design patterns"],
        actions: [
          "Estude 'Patterns.dev' (Lydia Hallie + Addy Osmani)",
          "Configure monorepo com Turborepo ou Nx + 2+ apps",
          "Implemente design system local com Storybook + tokens",
        ],
        evidence: "Repo monorepo + storybook publicado",
      },
      {
        order: 3,
        title: "Developer Experience + tooling",
        durationWeeks: 8,
        skills: ["dx", "tooling", "ci/cd", "testing"],
        actions: [
          "Implemente CI com lint + types + Playwright + visual regression",
          "Configure preview deploys pra cada PR (Vercel/Netlify)",
          "Escreva 1 plugin/script que melhora DX do time",
        ],
        evidence: "Pipeline funcional + feedback do time sobre DX",
      },
      {
        order: 4,
        title: "Lideranca de specs",
        durationWeeks: 6,
        skills: ["tech writing", "rfcs", "code review", "mentoring"],
        actions: [
          "Escreva 3 RFCs sobre escolhas frontend (state mgmt, framework, a11y)",
          "Mentore 1-2 frontend juniores formalmente",
          "Lidere code review com guia escrito pro time",
        ],
        evidence: "3 RFCs publicas + feedback de mentoria",
      },
      {
        order: 5,
        title: "Posicionamento Sr",
        durationWeeks: 6,
        skills: ["interviewing", "system design", "personal brand"],
        actions: [
          "Pratique frontend system design (greatfrontend.com)",
          "Construa 1 projeto pessoal showcase com perf + a11y A+",
          "Aplique pra 15+ vagas FE Sr com portfolio",
        ],
        evidence: "Projeto showcase publico + 5+ candidaturas",
      },
    ],
  },

  "data engineer senior": {
    targetTitle: "Data Engineer Senior",
    timeline: "12-15 meses",
    milestones: [
      {
        order: 1,
        title: "Arquitetura de pipelines",
        durationWeeks: 10,
        skills: ["data pipelines", "airflow", "dbt", "spark", "kafka"],
        actions: [
          "Livro 'Fundamentals of Data Engineering' (Joe Reis + Matt Housley)",
          "Construa pipeline batch + streaming com Airflow + Kafka",
          "Implemente medallion architecture (bronze/silver/gold) com dbt",
        ],
        evidence: "Repo com pipeline end-to-end + diagrama de arquitetura",
      },
      {
        order: 2,
        title: "Data quality + testing",
        durationWeeks: 8,
        skills: ["data quality", "great expectations", "dbt tests", "data contracts"],
        actions: [
          "Implemente testes de dados com Great Expectations ou dbt tests",
          "Defina SLA + SLO pra 3+ pipelines criticas",
          "Configure alertas de qualidade com Slack/PagerDuty",
        ],
        evidence: "Suite de testes + dashboard de quality com SLOs",
      },
      {
        order: 3,
        title: "Governance + seguranca",
        durationWeeks: 8,
        skills: ["data governance", "lgpd", "lineage", "catalog"],
        actions: [
          "Implemente data catalog (DataHub, OpenMetadata ou Amundsen)",
          "Mapeie lineage de 5+ datasets criticos",
          "Aplique mascaramento PII em conformidade com LGPD",
        ],
        evidence: "Catalog publicado + politicas de governance documentadas",
      },
      {
        order: 4,
        title: "Mentoring + lideranca tecnica",
        durationWeeks: 8,
        skills: ["mentoring", "tech writing", "code review", "rfcs"],
        actions: [
          "Mentore 2 data engineers juniores formalmente",
          "Escreva 3 RFCs sobre escolhas de stack (warehouse, orquestrador)",
          "Estabeleca padrao de code review pra SQL + Python no time",
        ],
        evidence: "3 RFCs + feedback de mentoria registrado",
      },
      {
        order: 5,
        title: "Posicionamento Sr",
        durationWeeks: 6,
        skills: ["interviewing", "system design", "personal brand"],
        actions: [
          "Pratique data system design (DataExpert.io, 10+ sessoes)",
          "Reescreva CV com narrativa de impacto em pipelines",
          "Aplique pra 15+ vagas DE Sr com cases adaptados",
        ],
        evidence: "5+ candidaturas DE Sr + 1 final round",
      },
    ],
  },

  "devops sre senior": {
    targetTitle: "DevOps/SRE Senior",
    timeline: "12-15 meses",
    milestones: [
      {
        order: 1,
        title: "SLI/SLO + error budget",
        durationWeeks: 8,
        skills: ["sli", "slo", "error budget", "reliability"],
        actions: [
          "Livro 'Site Reliability Engineering' (Google, gratis online)",
          "Defina SLI/SLO pra 3+ servicos com error budget",
          "Implemente burn rate alerts com multi-window",
        ],
        evidence: "Dashboard de SLO + 1 decisao baseada em error budget",
      },
      {
        order: 2,
        title: "Observability profunda",
        durationWeeks: 10,
        skills: ["observability", "tracing", "metrics", "logs", "opentelemetry"],
        actions: [
          "Implemente OpenTelemetry full-stack (metrics + traces + logs)",
          "Configure Grafana + Prometheus + Loki + Tempo (ou Datadog)",
          "Crie 5+ dashboards golden signals + runbooks linkados",
        ],
        evidence: "Stack de obs funcional + 5 dashboards + runbooks",
      },
      {
        order: 3,
        title: "Incident response + postmortems",
        durationWeeks: 8,
        skills: ["incident management", "postmortem", "chaos engineering"],
        actions: [
          "Lidere 2+ incidents reais como incident commander",
          "Conduza 3 postmortems blameless com action items",
          "Rode 1 game day com cenarios de falha controlada",
        ],
        evidence: "3 postmortems publicos (anonimizados) + game day report",
      },
      {
        order: 4,
        title: "On-call leadership + cultura",
        durationWeeks: 8,
        skills: ["on-call", "runbooks", "automation", "mentoring"],
        actions: [
          "Reorganize rotacao on-call do time pra reduzir burnout",
          "Automatize 5+ tarefas manuais comuns de on-call",
          "Mentore 2 SREs juniores em incident handling",
        ],
        evidence: "Plano de on-call documentado + metricas de toil reduzido",
      },
      {
        order: 5,
        title: "Posicionamento Sr",
        durationWeeks: 6,
        skills: ["interviewing", "system design", "personal brand"],
        actions: [
          "Pratique SRE interviews (system design + troubleshooting)",
          "Reescreva CV com narrativa de uptime + impacto",
          "Aplique pra 15+ vagas SRE Sr com cases adaptados",
        ],
        evidence: "5+ candidaturas + 1 talk sobre SRE em meetup",
      },
    ],
  },

  "security engineer": {
    targetTitle: "Security Engineer",
    timeline: "12-15 meses",
    milestones: [
      {
        order: 1,
        title: "AppSec fundamentos",
        durationWeeks: 10,
        skills: ["owasp", "appsec", "secure coding", "threat modeling"],
        actions: [
          "Estude OWASP Top 10:2025 + ASVS 5.0 detalhado",
          "Faca PortSwigger Web Security Academy (gratis, 200+ labs)",
          "Conduza threat modeling STRIDE em 1 sistema real",
        ],
        evidence: "Threat model documentado + 50+ labs concluidos no PortSwigger",
      },
      {
        order: 2,
        title: "Pentest + offensive",
        durationWeeks: 12,
        skills: ["pentest", "burp suite", "ctf", "exploit development"],
        actions: [
          "Certificacao OSCP ou PNPT (PNPT mais barato, ~400 USD)",
          "Resolva 30+ maquinas HackTheBox ou TryHackMe",
          "Conduza 1 pentest interno com relatorio formal",
        ],
        evidence: "Cert OSCP/PNPT + 1 relatorio de pentest (anonimizado)",
      },
      {
        order: 3,
        title: "Compliance + governance",
        durationWeeks: 8,
        skills: ["lgpd", "iso 27001", "soc 2", "risk management"],
        actions: [
          "Estude ISO 27001 + LGPD aplicada (curso EXIN ou similar)",
          "Mapeie controles de seguranca de 1 produto contra SOC 2",
          "Implemente 5+ controles tecnicos faltantes",
        ],
        evidence: "Gap analysis SOC 2 + 5 controles implementados",
      },
      {
        order: 4,
        title: "Incident response + forensics",
        durationWeeks: 8,
        skills: ["incident response", "forensics", "siem", "threat hunting"],
        actions: [
          "Configure SIEM (Wazuh, ELK ou Splunk) em lab pessoal",
          "Conduza 1 tabletop exercise de incident response",
          "Pratique threat hunting com MITRE ATT&CK em 5+ cenarios",
        ],
        evidence: "Lab de SIEM + 1 playbook de IR documentado",
      },
      {
        order: 5,
        title: "Posicionamento + comunidade",
        durationWeeks: 6,
        skills: ["interviewing", "writeups", "personal brand"],
        actions: [
          "Publique 3 writeups tecnicos (CTF, CVE, bug bounty)",
          "Apresente em meetup de seguranca local (BHack, H2HC, etc)",
          "Aplique pra 15+ vagas Security Eng com portfolio",
        ],
        evidence: "Writeups publicos + 1 talk + 5+ candidaturas",
      },
    ],
  },

  "ux researcher": {
    targetTitle: "UX Researcher",
    timeline: "10-12 meses",
    milestones: [
      {
        order: 1,
        title: "Metodos de pesquisa",
        durationWeeks: 10,
        skills: ["user research", "interviews", "usability testing", "ethnography"],
        actions: [
          "Livro 'Just Enough Research' (Erika Hall)",
          "Curso NN/g UX Research (modulos foundations + qualitative)",
          "Conduza 20+ entrevistas qualitativas com protocolo formal",
        ],
        evidence: "20 entrevistas + protocolo de research documentado",
      },
      {
        order: 2,
        title: "Sintese + insights",
        durationWeeks: 8,
        skills: ["affinity mapping", "personas", "journey mapping", "thematic analysis"],
        actions: [
          "Conduza 3 estudos completos discovery -> sintese -> insights",
          "Construa 3 journey maps + 2 personas baseadas em dados",
          "Use Dovetail ou Notion pra sistema de research repository",
        ],
        evidence: "Research repo organizado + 3 estudos publicados",
      },
      {
        order: 3,
        title: "Mixed methods + quantitative",
        durationWeeks: 8,
        skills: ["surveys", "statistics", "ab testing", "analytics"],
        actions: [
          "Curso 'Quantitative UX Research' (Coursera ou NN/g)",
          "Conduza 2 surveys com analise estatistica (N > 200)",
          "Triangule qualitative + quantitative em 1 estudo",
        ],
        evidence: "2 estudos quant + 1 estudo mixed-methods documentado",
      },
      {
        order: 4,
        title: "Stakeholder management + insights to action",
        durationWeeks: 6,
        skills: ["stakeholder management", "storytelling", "research ops"],
        actions: [
          "Apresente 3 readouts pra stakeholders C-level com decisao",
          "Construa research repository acessivel pra time inteiro",
          "Defina ritual mensal de research review",
        ],
        evidence: "3 readouts + research repo com 10+ acessos/mes",
      },
      {
        order: 5,
        title: "Posicionamento",
        durationWeeks: 6,
        skills: ["portfolio", "interviewing", "personal brand"],
        actions: [
          "Construa portfolio com 3 cases profundos (research -> impacto)",
          "Pratique research interviews (case studies + behavioral)",
          "Aplique pra 15+ vagas UXR com portfolio adaptado",
        ],
        evidence: "Portfolio publico + 5+ candidaturas",
      },
    ],
  },

  "growth pm": {
    targetTitle: "Growth Product Manager",
    timeline: "10-12 meses",
    milestones: [
      {
        order: 1,
        title: "Acquisition + canais",
        durationWeeks: 8,
        skills: ["seo", "paid acquisition", "content marketing", "attribution"],
        actions: [
          "Livro 'Hacking Growth' (Sean Ellis + Morgan Brown)",
          "Implemente SEO tecnico + content em 1 site real",
          "Rode 3+ campanhas pagas com CAC + LTV calculados",
        ],
        evidence: "Site com SEO A+ + 3 campanhas com metricas",
      },
      {
        order: 2,
        title: "Activation + onboarding",
        durationWeeks: 8,
        skills: ["activation", "onboarding", "funnel analysis", "aha moment"],
        actions: [
          "Curso 'Growth Series' (Reforge, modulo Activation)",
          "Mapeie funnel completo + identifique aha moment de 1 produto",
          "Otimize onboarding com 3+ experimentos iterativos",
        ],
        evidence: "Funnel mapeado + 1 melhoria documentada com %",
      },
      {
        order: 3,
        title: "Retention + engagement",
        durationWeeks: 8,
        skills: ["retention", "engagement", "cohort analysis", "habit loops"],
        actions: [
          "Analise cohort de retencao + identifique drop-offs",
          "Implemente 3 mecanicas de retencao (notificacoes, gamification)",
          "Curso 'Retention + Engagement' (Reforge)",
        ],
        evidence: "Curva de retencao + 3 melhorias com impacto medido",
      },
      {
        order: 4,
        title: "Experimentacao rigorosa",
        durationWeeks: 8,
        skills: ["ab testing", "statistical significance", "experimentation"],
        actions: [
          "Configure plataforma de experimentacao (Statsig, GrowthBook)",
          "Rode 10+ A/B tests com analise estatistica correta",
          "Curso 'Experimentation' (Reforge ou Eppo Academy)",
        ],
        evidence: "10 experimentos documentados + playbook de exp",
      },
      {
        order: 5,
        title: "Posicionamento Growth",
        durationWeeks: 6,
        skills: ["interviewing", "case studies", "personal brand"],
        actions: [
          "Prepare 5 cases STAR com metricas de growth movidas",
          "Mock interview de growth (Exponent + Reforge)",
          "Aplique pra 15+ vagas Growth PM com portfolio",
        ],
        evidence: "5+ candidaturas Growth + 1 case publicado",
      },
    ],
  },

  "cto early stage": {
    targetTitle: "CTO Early Stage Startup",
    timeline: "15-18 meses",
    milestones: [
      {
        order: 1,
        title: "Estrategia tecnica + arquitetura inicial",
        durationWeeks: 10,
        skills: ["architecture", "tech strategy", "trade-off analysis", "mvp"],
        actions: [
          "Livro 'The CTO Handbook' (Lapwing Labs) + 'Staff Engineer' (Will Larson)",
          "Construa MVP funcional com escolha justificada de stack",
          "Escreva tech strategy document de 12 meses",
        ],
        evidence: "MVP publico + tech strategy aprovada por co-founders",
      },
      {
        order: 2,
        title: "Team building + hiring",
        durationWeeks: 12,
        skills: ["hiring", "interviewing", "team design", "compensation"],
        actions: [
          "Contrate 3+ engenheiros (define rubric, conduza loop completo)",
          "Defina compensation framework com equity + salary bands",
          "Configure rituals do time (standup, planning, retro)",
        ],
        evidence: "3 contratacoes + framework de comp documentado",
      },
      {
        order: 3,
        title: "Fundraising + due diligence tecnica",
        durationWeeks: 8,
        skills: ["fundraising", "pitch", "due diligence", "financial modeling"],
        actions: [
          "Prepare tech due diligence package (arch, segur, scaling plan)",
          "Pratique pitch tecnico com 5+ investidores reais ou simulados",
          "Curso 'Y Combinator Startup School' (gratis)",
        ],
        evidence: "Tech DD doc + feedback de 5+ investidores",
      },
      {
        order: 4,
        title: "Product partnership + customer dev",
        durationWeeks: 8,
        skills: ["product strategy", "customer development", "discovery"],
        actions: [
          "Conduza 20+ customer interviews diretamente",
          "Lidere prioritizacao de roadmap junto com CEO/CPO",
          "Estabeleca ritmo de release + feedback loop com customers",
        ],
        evidence: "20 interviews + roadmap trimestral co-criado",
      },
      {
        order: 5,
        title: "Scaling + posicionamento",
        durationWeeks: 10,
        skills: ["org design", "delegation", "public speaking", "personal brand"],
        actions: [
          "Contrate primeiro EM ou Tech Lead pra delegar lideranca tecnica",
          "Defina org chart 12-24 meses com prioridades de hiring",
          "Apresente em evento de startup (CASE, Web Summit RJ) + construa rede com 20+ CTOs early-stage",
        ],
        evidence: "Primeira contratacao de lideranca + org plan + 1 talk publica",
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
