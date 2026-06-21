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
