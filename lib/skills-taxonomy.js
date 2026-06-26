// Taxonomia inicial de skills do gemeo. Pequena de proposito (Fase 2):
// cobre os termos que mais aparecem em vagas tech/data/produto BR. Cada chave
// canonica tem aliases (lowercase, sem acentos) para extracao de texto livre.
// Aumentar com cuidado — em Fase 3 isso vira embeddings.

export const SKILLS = {
  "SQL":            ["sql"],
  "Python":         ["python"],
  "JavaScript":     ["javascript", "js"],
  "TypeScript":     ["typescript", "ts"],
  "React":          ["react", "reactjs", "react.js"],
  "Next.js":        ["next.js", "nextjs", "next"],
  "Node.js":        ["node.js", "nodejs", "node"],
  "Go":             ["golang", "go"],
  "Java":           ["java"],
  "Kotlin":         ["kotlin"],
  "AWS":            ["aws", "amazon web services"],
  "GCP":            ["gcp", "google cloud"],
  "Azure":          ["azure"],
  "Docker":         ["docker", "containers"],
  "Kubernetes":     ["kubernetes", "k8s"],
  "Airflow":        ["airflow"],
  "dbt":            ["dbt"],
  "Spark":          ["spark", "pyspark"],
  "Tableau":        ["tableau"],
  "Power BI":       ["power bi", "powerbi"],
  "Looker":         ["looker", "looker studio"],
  "Machine Learning":["machine learning", "ml", "machine-learning"],
  "LLM":            ["llm", "large language model"],
  "Product Management":["product manager", "product management", "gestao de produto", "produto digital", "pm"],
  "UX":             ["ux", "user experience"],
  "Marketing":      ["marketing", "growth"],
  "SEO":            ["seo"],
  "Vendas":         ["vendas", "sales"],
  "CRM":            ["crm", "salesforce"],
  "Inglês":         ["ingles", "english", "fluent english", "ingles fluente", "ingles avancado"],
  "Liderança":      ["lideranca", "leadership", "gestao de pessoas", "people management"],
  "Agile":          ["agile", "scrum", "kanban", "agil"],
  "Git":            ["git", "github", "gitlab"],
  "Excel":          ["excel"],
  "Data Engineering":["data engineer", "data engineering", "engenharia de dados"],
  "Data Science":   ["data scientist", "data science", "cientista de dados"],
  "Data Analytics": ["data analyst", "analytics", "analise de dados"],
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

// Match deterministico: % de skills do perfil que aparecem na vaga,
// com peso extra para skills do role-alvo / lacunas declaradas.
export function matchScore({ profileSkills, jobSkills }) {
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
  // Score = comuns / total da vaga (quantos requisitos voce cobre).
  const match = Math.round((comuns.length / j.size) * 100);
  return { match, comuns, falta };
}
