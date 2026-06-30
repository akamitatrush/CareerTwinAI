// Taxonomia de skills do gemeo. Expansao 2026-06-29 (auditoria Gandalf,
// Risco #2): de 38 -> 115 entradas pra cobrir personas Marketing/Finance/
// ESG/Product/Data alem de tech. Cada chave canonica tem aliases
// (lowercase, sem acentos) — extractSkills() faz word-boundary match.
//
// Limites conhecidos:
//  - Ordem de iteracao importa pra "ml" (curto) — mas word-boundary impede
//    falso positivo em "html"/"xml" (vide funcao normalize+match abaixo).
//  - "Excel Avancado" nao tem entrada propria (colidiria com "Excel"); o
//    valor da skill esta na presenca, nao no nivel.
//  - Em Fase 3 isso vira embedding + reranking de similaridade. Esta
//    expansao e ponte temporal pra remover o vies tech sistemico do MVP.

export const SKILLS = {
  // --- Linguagens e runtimes ---
  "SQL":            ["sql"],
  "Python":         ["python"],
  "JavaScript":     ["javascript", "js"],
  "TypeScript":     ["typescript", "ts"],
  "Go":             ["golang", "go"],
  "Java":           ["java"],
  "Kotlin":         ["kotlin"],
  "Rust":           ["rust"],
  "Scala":          ["scala"],
  "Ruby":           ["ruby"],
  "PHP":            ["php"],
  "C#":             ["c#", "csharp"],
  ".NET":           [".net", "dotnet"],
  "Swift":          ["swift"],

  // --- Frontend ---
  "React":          ["react", "reactjs", "react.js"],
  "Next.js":        ["next.js", "nextjs", "next"],
  "Vue.js":         ["vue", "vuejs", "vue.js"],
  "Angular":        ["angular", "angularjs"],
  "Svelte":         ["svelte", "sveltekit"],
  "HTML":           ["html", "html5"],
  "CSS":            ["css", "css3"],
  "Tailwind":       ["tailwind", "tailwindcss", "tailwind css"],

  // --- Backend frameworks ---
  "Node.js":        ["node.js", "nodejs", "node"],
  "Express":        ["express", "expressjs", "express.js"],
  "NestJS":         ["nestjs", "nest.js"],
  "Django":         ["django"],
  "FastAPI":        ["fastapi", "fast api"],
  "Rails":          ["rails", "ruby on rails", "ror"],
  "Spring":         ["spring", "spring boot", "springboot"],

  // --- Mobile ---
  "React Native":   ["react native", "react-native"],
  "Flutter":        ["flutter"],
  "iOS":            ["ios"],
  "Android":        ["android"],

  // --- Cloud e infra ---
  "AWS":            ["aws", "amazon web services"],
  "GCP":            ["gcp", "google cloud", "google cloud platform"],
  "Azure":          ["azure", "microsoft azure"],
  "Docker":         ["docker", "containers"],
  "Kubernetes":     ["kubernetes", "k8s"],
  "Terraform":      ["terraform", "iac", "infrastructure as code"],
  "Ansible":        ["ansible"],
  "Linux":          ["linux", "shell", "bash"],
  "Nginx":          ["nginx"],
  "CI/CD":          ["ci/cd", "cicd", "continuous integration", "continuous delivery"],
  "GitHub Actions": ["github actions"],

  // --- Bancos e storage ---
  "PostgreSQL":     ["postgresql", "postgres", "postgre"],
  "MySQL":          ["mysql"],
  "MongoDB":        ["mongodb", "mongo"],
  "Redis":          ["redis"],
  "Elasticsearch":  ["elasticsearch", "elastic", "opensearch"],

  // --- Mensageria e streaming ---
  "Kafka":          ["kafka", "apache kafka"],
  "RabbitMQ":       ["rabbitmq", "rabbit mq"],

  // --- Data engineering / warehouse ---
  "Airflow":        ["airflow", "apache airflow"],
  "dbt":            ["dbt"],
  "Spark":          ["spark", "pyspark", "apache spark"],
  "BigQuery":       ["bigquery", "big query"],
  "Snowflake":      ["snowflake"],
  "Databricks":     ["databricks"],
  "Redshift":       ["redshift"],
  "ETL":            ["etl"],

  // --- BI ---
  "Tableau":        ["tableau"],
  "Power BI":       ["power bi", "powerbi"],
  "Looker":         ["looker", "looker studio"],

  // --- Data Science / ML / AI ---
  "Pandas":         ["pandas"],
  "NumPy":          ["numpy"],
  "Scikit-learn":   ["scikit-learn", "sklearn", "scikit learn"],
  "TensorFlow":     ["tensorflow", "tf"],
  "PyTorch":        ["pytorch"],
  "Machine Learning":["machine learning", "ml", "machine-learning"],
  "Deep Learning":  ["deep learning", "deep-learning"],
  "NLP":            ["nlp", "natural language processing"],
  "Computer Vision":["computer vision", "visao computacional"],
  "MLOps":          ["mlops", "ml ops"],
  "LLM":            ["llm", "large language model", "large language models"],
  "RAG":            ["rag", "retrieval augmented", "retrieval-augmented"],
  "LangChain":      ["langchain", "lang chain"],
  "Embeddings":     ["embeddings", "embedding"],
  "Prompt Engineering":["prompt engineering", "prompting", "prompt design"],
  "OpenAI":         ["openai", "gpt-4", "gpt-3"],
  "Anthropic":      ["anthropic", "claude"],
  "Estatística":    ["estatistica", "statistics", "statistical analysis"],

  // --- Disciplinas de dados (cargo/area) ---
  "Data Engineering":["data engineer", "data engineering", "engenharia de dados"],
  "Data Science":   ["data scientist", "data science", "cientista de dados"],
  "Data Analytics": ["data analyst", "analytics", "analise de dados"],

  // --- Design e UX ---
  "Figma":          ["figma"],
  "Sketch":         ["sketch app"],
  "Design System":  ["design system", "design systems"],
  "User Research":  ["user research", "pesquisa de usuario", "pesquisa com usuario"],
  "Prototype":      ["prototype", "prototipagem", "prototyping"],
  "UX":             ["ux", "user experience"],
  "UI":             ["ui design", "user interface"],
  "Accessibility":  ["accessibility", "a11y", "acessibilidade"],

  // --- Product Management ---
  "Product Management":["product manager", "product management", "gestao de produto", "produto digital", "pm"],
  "Product Owner":  ["product owner", "po"],
  "OKR":            ["okr", "okrs", "objectives and key results"],
  "KPI":            ["kpi", "kpis"],
  "Roadmap":        ["roadmap"],
  "Discovery":      ["discovery", "product discovery"],
  "A/B Testing":    ["a/b testing", "ab test", "ab testing", "split test"],
  "Google Analytics":["google analytics", "ga4"],
  "Mixpanel":       ["mixpanel"],
  "Amplitude":      ["amplitude"],

  // --- Marketing ---
  "Marketing":      ["marketing"],
  "Growth":         ["growth", "growth marketing", "growth hacking"],
  "SEO":            ["seo", "search engine optimization"],
  "Performance Marketing":["performance marketing", "midia paga", "trafego pago"],
  "Google Ads":     ["google ads", "adwords"],
  "Meta Ads":       ["meta ads", "facebook ads", "instagram ads"],
  "HubSpot":        ["hubspot"],
  "RD Station":     ["rd station", "rdstation"],
  "Email Marketing":["email marketing"],
  "Inbound":        ["inbound", "inbound marketing"],
  "Branding":       ["branding", "brand strategy"],
  "Copywriting":    ["copywriting", "copywriter"],

  // --- Vendas e CRM ---
  "Vendas":         ["vendas", "sales"],
  "CRM":            ["crm"],
  "Salesforce":     ["salesforce"],

  // --- Finance ---
  "Modelagem Financeira":["modelagem financeira", "financial modeling", "valuation"],
  "FP&A":           ["fp&a", "fp & a", "financial planning", "financial planning and analysis"],
  "Excel":          ["excel"],
  "Controladoria":  ["controladoria", "controllership"],
  "Contabilidade":  ["contabilidade", "accounting"],
  "IFRS":           ["ifrs"],

  // --- Compliance e Seguranca ---
  "LGPD":           ["lgpd"],
  "GDPR":           ["gdpr"],
  "OWASP":          ["owasp"],
  "ISO 27001":      ["iso 27001", "iso27001"],
  "Pentest":        ["pentest", "penetration test", "penetration testing"],
  "SIEM":           ["siem"],
  "Compliance":     ["compliance"],

  // --- ESG ---
  "ESG":            ["esg"],
  "Sustentabilidade":["sustentabilidade", "sustainability"],

  // --- Ferramentas corporativas ---
  "Jira":           ["jira"],
  "Notion":         ["notion"],
  "Confluence":     ["confluence"],
  "Slack":          ["slack"],
  "SAP":            ["sap"],

  // --- Idiomas ---
  "Inglês":         ["ingles", "english", "fluent english", "ingles fluente", "ingles avancado"],
  "Espanhol":       ["espanhol", "spanish"],
  "Francês":        ["frances", "french"],

  // --- Liderança e soft ---
  "Liderança":      ["lideranca", "leadership", "gestao de pessoas", "people management"],
  "Agile":          ["agile", "scrum", "kanban", "agil"],
  "Comunicação":    ["comunicacao", "communication"],
  "Resolução de Problemas":["problem solving", "resolucao de problemas"],
  "Pensamento Crítico":["pensamento critico", "critical thinking"],

  // --- Versionamento ---
  "Git":            ["git", "github", "gitlab"],
};

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // remove acentos
}

// Extrai skills canonicas de um texto livre (descricao de vaga ou cv).
export function extractSkills(text) {
  const t = normalize(text);
  if (!t) return [];
  const found = new Set();
  for (const [canon, aliases] of Object.entries(SKILLS)) {
    for (const a of aliases) {
      // Word boundary tosca (regex puro com \b nao trabalha para "node.js").
      const idx = t.indexOf(a);
      if (idx < 0) continue;
      const before = idx === 0 ? " " : t[idx - 1];
      const after = idx + a.length >= t.length ? " " : t[idx + a.length];
      if (!/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after)) {
        found.add(canon);
        break;
      }
    }
  }
  return Array.from(found);
}

// Mapa role -> skills tipicas. Usado pelo SkillGraph pra mostrar "skills
// que esse cargo pede" mesmo quando a gente nao tem uma JD especifica.
// Hardcoded de proposito (Fase 2) — em Fase 3 isso vira embeddings + scraping
// de descricao de vaga. Chaves sao lowercase e o lookup faz substring match
// pra absorver variacoes ("backend engineer", "ai engineer pleno", etc).
const ROLE_TO_SKILLS = {
  backend: ["python", "node", "sql", "docker", "kubernetes", "aws", "redis", "postgresql", "rest", "git"],
  frontend: ["javascript", "typescript", "react", "html", "css", "next.js", "tailwind", "git"],
  fullstack: ["javascript", "typescript", "react", "node", "sql", "docker", "git", "rest"],
  "data science": ["python", "scikit-learn", "pandas", "machine learning", "statistics", "deep learning"],
  "machine learning": ["python", "tensorflow", "pytorch", "scikit-learn", "ml", "deep learning", "mlops"],
  "ai engineer": ["python", "llm", "rag", "embeddings", "langchain", "prompt engineering", "openai", "anthropic"],
  data: ["sql", "python", "pandas", "looker", "etl", "spark", "airflow", "data warehouse"],
  ml: ["python", "tensorflow", "pytorch", "ml", "scikit-learn", "deep learning"],
  "product owner": ["roadmap", "backlog", "okr", "scrum", "discovery", "stakeholders", "metricas", "kpi"],
  "product manager": ["roadmap", "discovery", "okr", "metricas", "ux", "analytics", "growth"],
  po: ["roadmap", "backlog", "okr", "scrum", "discovery", "stakeholders"],
  pm: ["roadmap", "discovery", "okr", "metricas", "ux", "analytics"],
  designer: ["figma", "design system", "ux", "ui", "user research", "prototype"],
  ux: ["user research", "figma", "prototype", "ux", "accessibility"],
  devops: ["aws", "docker", "kubernetes", "terraform", "ci/cd", "monitoring", "linux"],
  sre: ["aws", "kubernetes", "monitoring", "incident response", "sli", "slo"],
  qa: ["test automation", "playwright", "cypress", "ci/cd", "selenium"],
  security: ["pentest", "owasp", "siem", "threat modeling", "incident response"],
};

// Ordem dos substring checks importa pra evitar match prematuro. "ml" e curto
// e bate em "html" / "xml" — entao deixamos chaves longas primeiro. Sort
// estavel por tamanho desc.
const ROLE_KEYS_BY_LENGTH = Object.keys(ROLE_TO_SKILLS).sort(
  (a, b) => b.length - a.length,
);

// Skills genericas que se aplicam a qualquer cargo quando nao temos match.
// Mantemos pequeno — soft skills + ferramenta basica.
const ROLE_FALLBACK = ["communication", "git", "agile"];

// Retorna skills tipicas pra um cargo-alvo (string livre).
//
// Estrategia:
//   1) match exato (normalizado lower+trim)
//   2) substring match (chaves mais longas primeiro pra evitar "ml" em "html")
//   3) fallback generico
//
// Quando role e null/undefined/vazio, retorna [] pra deixar o caller decidir
// se mostra grafo vazio ou esconde o componente. Nao retorna fallback nesse
// caso porque "skills pra cargo desconhecido" enganaria o user.
export function skillsForRole(role) {
  if (!role) return [];
  const normalized = String(role).toLowerCase().trim();
  if (!normalized) return [];

  // Match exato
  if (ROLE_TO_SKILLS[normalized]) return ROLE_TO_SKILLS[normalized];

  // Substring (longest first)
  for (const key of ROLE_KEYS_BY_LENGTH) {
    if (normalized.includes(key)) return ROLE_TO_SKILLS[key];
  }

  return ROLE_FALLBACK;
}

// Categoriza skills do user em 3 buckets dado o cargo-alvo. Funcao pura
// (testavel) que espelha o que o SkillGraph faz visualmente. Util tambem
// pra outros lugares que queiram a info sem renderizar o grafo (ex: API).
//
// Normalizacao: lowercase + trim + filtra falsy. NAO usa Set tipo-dependente —
// listas pequenas, .filter cobre bem.
export function categorizeSkills({ profileSkills, targetSkills }) {
  const profile = Array.isArray(profileSkills)
    ? profileSkills
        .map((s) => String(s || "").toLowerCase().trim())
        .filter(Boolean)
    : [];
  const target = Array.isArray(targetSkills)
    ? targetSkills
        .map((s) => String(s || "").toLowerCase().trim())
        .filter(Boolean)
    : [];

  const profileSet = new Set(profile);
  const targetSet = new Set(target);

  return {
    have: profile.filter((s) => targetSet.has(s)),
    haveExtra: profile.filter((s) => !targetSet.has(s)),
    missing: target.filter((s) => !profileSet.has(s)),
  };
}

// Tokens funcionais "ruidosos" — senioridade, conectivos e qualificadores que
// nao discriminam role. Usados em role-match e em pre-filtros de provider ATS.
// Mantenha em sincronia com lib/jobs/index.js NOISE_TOKENS (sao quase iguais
// mas separados pra evitar circular deps).
const ROLE_NOISE_TOKENS = new Set([
  "junior", "jr", "trainee", "pleno", "mid", "senior", "sr", "lead",
  "principal", "staff", "especialista", "especialist", "manager", "gerente",
  "de", "da", "do", "para", "em", "com", "the", "of", "and", "or",
  "i", "ii", "iii", "iv",
]);

// Niveis de senioridade canonicos. A ordem importa: junior < pleno < senior.
// Usado em senioritySignal pra calcular distancia ordinal.
const SENIORITY_ORDER = { junior: 0, pleno: 1, senior: 2 };

// Aliases por nivel — espelha o que /api/opportunities/route.js:179-183 usa
// no filtro de UI. Mantem em sync ali se mudarmos aqui (ou refatorar pra
// usar este export — feito em sequencia ja que /route.js nao re-exporta).
const SENIORITY_ALIASES = {
  junior: ["junior", "jr", "trainee", "estagio", "estagiario", "internship"],
  pleno: ["pleno", "mid", "mid-level", "midlevel", "intermediario"],
  senior: ["senior", "sr", "lead", "principal", "staff", "head", "diretor", "director"],
};

// Extrai tokens canonicos de um titulo (ou cargo-alvo) pra computar role
// similarity. Strippa noise (senioridade, conectivos) e normaliza acentos.
// Tokens curtos (<3 chars) sao ignorados pra evitar ruido tipo "de/em".
export function extractTitleTokens(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !ROLE_NOISE_TOKENS.has(t));
}

// Detecta senioridade num titulo/cargo. Retorna null se nao identificado
// (nao penaliza — vagas sem senioridade declarada sao neutras).
export function detectSeniority(text) {
  const norm = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  for (const [level, aliases] of Object.entries(SENIORITY_ALIASES)) {
    for (const a of aliases) {
      // Word-boundary tosca: aceita aliases delimitados por nao-alfanumerico.
      const re = new RegExp(`(^|[^a-z0-9])${a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`);
      if (re.test(norm)) return level;
    }
  }
  return null;
}

// Role similarity via Jaccard de tokens funcionais. Retorna [0..1].
// "Senior Backend Engineer" vs "Backend Engineer Pleno": tokens =
//   {backend, engineer} vs {backend, engineer} → 1.0
// "Senior Backend Engineer" vs "QA Engineer Pleno": tokens =
//   {backend, engineer} vs {qa, engineer} → 1/3 = 0.33
// Retorna 0 quando algum lado nao tem token funcional (defensive: nao inflar
// score pra titulos vazios depois de strippar noise).
export function roleSimilarity(targetRole, jobTitle) {
  const a = new Set(extractTitleTokens(targetRole));
  const b = new Set(extractTitleTokens(jobTitle));
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  // Jaccard: |inter| / |union|.
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

// Senioridade match: 1.0 se mesmo nivel, 0.5 se 1 step de distancia, 0 se 2.
// Quando algum lado e null (nao detectado), retorna 0.7 — neutro positivo
// (nao penaliza vagas sem nivel declarado, comum em fixtures e ATS pequenos).
// Justificativa do 0.7: melhor que random (0.5) mas menor que match perfeito;
// vagas com nivel claro batendo o perfil ganham vantagem de ranking.
export function senioritySignal(profileSeniority, jobSeniority) {
  const a = profileSeniority ? String(profileSeniority).toLowerCase() : null;
  const b = jobSeniority ? String(jobSeniority).toLowerCase() : null;
  if (!a || !b) return 0.7;
  const ia = SENIORITY_ORDER[a];
  const ib = SENIORITY_ORDER[b];
  if (ia == null || ib == null) return 0.7;
  const dist = Math.abs(ia - ib);
  if (dist === 0) return 1;
  if (dist === 1) return 0.5;
  return 0;
}

// Match deterministico multi-sinal.
//
// Decisao PO §P0.3 (docs/fluxos/auditoria/30062026/po-oportunidades-auditoria.md
// §P0.3 + §4.5): matchScore antigo so olhava overlap de skills — "Senior
// Backend Engineer" recebia "QA Engineer Pleno" com 100% (skills genericas
// cobertas) enquanto Backend Senior real caia em 4o lugar. Combinamos 3 sinais:
//   - skills overlap (50%)   — ja existia; preserva comportamento legado
//   - role similarity (30%)  — Jaccard de tokens funcionais titulo vs cargo
//   - senioridade match (20%) — 1.0/0.5/0 por distancia ordinal
//
// Pesos 50/30/20 sao decisao temporaria — A/B test posterior valida (medir
// precision@5 via opportunity.click events, ver §P2.5 do audit).
//
// Backward compat: quando targetRole/jobTitle nao informados, comportamento
// legado (skills puro / |jobSkills|). Cron digest (app/api/cron/digest/route.js:109)
// e tests historicos continuam funcionando sem mudanca.
export function matchScore({
  profileSkills,
  jobSkills,
  targetRole,
  jobTitle,
  profileSeniority,
}) {
  const p = new Set((profileSkills || []).map(normalize));
  const j = new Set((jobSkills || []).map(normalize));
  if (!p.size || !j.size) return { match: 0, comuns: [], falta: [] };
  const comuns = [];
  const falta = [];
  for (const s of j) {
    const has = [...p].some((ps) => ps === s || ps.includes(s) || s.includes(ps));
    if (has) comuns.push(s);
    else falta.push(s);
  }
  // Skills score (0..1): proporcao de requisitos da vaga cobertos pelo perfil.
  const skillsScore = comuns.length / j.size;

  // Backward compat: sem targetRole/jobTitle, retorna SO o skills score como
  // % inteiro. Preserva contrato de chamadas antigas (cron/digest, tests).
  if (!targetRole && !jobTitle) {
    return { match: Math.round(skillsScore * 100), comuns, falta };
  }

  // Multi-sinal (PO §P0.3): role similarity (0..1) + senioridade (0..1).
  const roleScore = roleSimilarity(targetRole, jobTitle);
  const jobSeniorityDetected = detectSeniority(jobTitle);
  const senScore = senioritySignal(profileSeniority, jobSeniorityDetected);

  // Pesos: 50% skills, 30% role, 20% senioridade. Documentado como decisao
  // temporaria — A/B test posterior (po-audit §P2.5) calibra empiricamente.
  const blended = 0.5 * skillsScore + 0.3 * roleScore + 0.2 * senScore;
  const match = Math.round(blended * 100);

  return {
    match,
    comuns,
    falta,
    // Breakdown auditavel (pilar #1 do produto) — UI pode mostrar e dev pode logar.
    breakdown: {
      skills: Math.round(skillsScore * 100),
      role: Math.round(roleScore * 100),
      seniority: Math.round(senScore * 100),
      weights: { skills: 0.5, role: 0.3, seniority: 0.2 },
    },
  };
}
