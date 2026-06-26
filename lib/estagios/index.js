// Provider de Estagios (BR) — wrapper sobre Adzuna + Jooble filtrando por
// tipo "estagio" / "internship". Persona alvo: 18-25, estudante universitario.
//
// Estrategia de filtro internship:
//  1. Adzuna SUPORTA contract_type=internship nativamente (param documentado em
//     https://developer.adzuna.com/docs/search). Mandamos esse param + what=estagio
//     na query pra maximizar recall.
//  2. Jooble NAO tem filtro nativo de internship type. Estrategia: keyword
//     "estagio" + "intern" no campo `keywords`. Resultado e filtrado pos-fetch
//     via heuristica (titulo/descricao contem estag|intern|trainee + bolsa < 2500).
//  3. Heuristica de bolsa (< R$ 2.500) NAO e estrita: estagios em BR pagam
//     em media R$ 800-2.000 (NUBE 2024). Vagas sem salario passam (provider
//     muitas vezes nao expoe valor) — confiamos no titulo nesse caso.
//
// Cache 30min (vs 10min do searchJobs): estagios sao publicados em batch
// (segundas-feiras geralmente), churn menor. Trade-off: ate segunda usuario
// pode ver lista um pouco velha — aceitavel pra reduzir custo API.
//
// Defesa OWASP: NUNCA throw (graceful per-provider via Promise.allSettled),
// timeout 8s com AbortController, UA identificado, schema validado, sem PII.

import { cacheGet, cacheSet } from "@/lib/jobs/cache";

const TIMEOUT_MS = 8_000;
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min — estagios mudam menos
const BOLSA_MAX_HEURISTICA = 2_500; // R$/mes; vagas acima dropam se nao tem keyword
const USER_AGENT = "CareerTwin AI Internships Aggregator (https://career-twin-ai.vercel.app)";

// Palavras-chave que indicam estagio no titulo/descricao. Inclui ingles porque
// muitas vagas BR remotas usam "intern" mesmo o board sendo PT-BR.
const INTERNSHIP_KEYWORDS = [
  "estag", // estagio, estagiar, estagiario, estagiaria
  "intern", // intern, internship
  "trainee", // programas trainee tambem fazem sentido pra estudante
];

// UF -> regiao (so pra Adzuna que aceita `where`). Adzuna BR aceita
// nome do estado/cidade em portugues; mantemos UF -> nome aproximado.
// Nao perfeitamente preciso, mas Adzuna faz fuzzy match interno.
const UF_TO_REGION = {
  AC: "Acre", AL: "Alagoas", AM: "Amazonas", AP: "Amapá",
  BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo",
  GO: "Goiás", MA: "Maranhão", MG: "Minas Gerais", MS: "Mato Grosso do Sul",
  MT: "Mato Grosso", PA: "Pará", PB: "Paraíba", PE: "Pernambuco", PI: "Piauí",
  PR: "Paraná", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RO: "Rondônia",
  RR: "Roraima", RS: "Rio Grande do Sul", SC: "Santa Catarina", SE: "Sergipe",
  SP: "São Paulo", TO: "Tocantins",
};

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

async function withTimeout(url, init = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: ctl.signal,
      headers: {
        "user-agent": USER_AGENT,
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(t);
  }
}

function normalize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// Heuristica: detecta se uma vaga e estagio com base em titulo + descricao + salario.
// Retorna true se:
//  - Titulo OU descricao contem palavra-chave de estagio, OU
//  - Salario presente e <= R$ 2.500 (com ressalva: vaga deve tambem ter algum
//    indicio textual fraco — sem isso, qualquer junior de baixo salario passaria).
//
// Conservador propositalmente: melhor dropar uma vaga real de estagio do que
// poluir o radar com vagas CLT regulares de baixo salario.
function looksLikeInternship({ titulo, descricao, bolsa }) {
  const hay = `${normalize(titulo)} ${normalize(descricao)}`;
  const hasKeyword = INTERNSHIP_KEYWORDS.some((k) => hay.includes(k));
  if (hasKeyword) return true;
  // Sem keyword: aceita se salario abaixo do teto E nao tem indicio de CLT/senior.
  if (bolsa != null && bolsa > 0 && bolsa <= BOLSA_MAX_HEURISTICA) {
    const negative = /\b(senior|sr\b|pleno|lead|principal|coordenador|gerente|gestor|cargo efetivo|clt)\b/i.test(hay);
    if (!negative) return true;
  }
  return false;
}

// Detecta modalidade do texto (titulo+descricao+local). "" se ambiguo.
function detectModalidade(text) {
  const t = normalize(text);
  if (/remot|home.?office|teletrabalho/.test(t)) return "Remoto";
  if (/hibrid/.test(t)) return "Híbrido";
  if (/presencial|on.?site/.test(t)) return "Presencial";
  return null;
}

// Extrai UF de string "Cidade, UF" ou "Cidade - UF" (padrao BR).
function extractUf(localStr) {
  if (typeof localStr !== "string") return null;
  const m = localStr.match(/\b([A-Z]{2})\b/);
  if (!m) return null;
  const uf = m[1];
  return UF_TO_REGION[uf] ? uf : null;
}

// Extrai area aproximada do titulo. Lista curada — bata em substring.
const AREAS_KEYWORDS = {
  ti: ["desenvolv", "software", "ti ", "tecnologia", "backend", "frontend", "fullstack", "dados", "data", "devops", "qa"],
  marketing: ["marketing", "growth", "midia", "comunicacao", "comunicação"],
  vendas: ["vendas", "comercial", "sales"],
  financas: ["financ", "financeiro", "contabil", "controladoria"],
  rh: ["rh ", "people", "recursos humanos", "talent"],
  juridico: ["juridico", "jurídico", "direito", "legal"],
  engenharia: ["engenharia", "civil", "mecanic", "eletric", "producao"],
  saude: ["saude", "saúde", "enferm", "medicina"],
  design: ["design", "ux", "ui"],
};

function inferArea(titulo) {
  const t = normalize(titulo);
  for (const [area, keys] of Object.entries(AREAS_KEYWORDS)) {
    if (keys.some((k) => t.includes(k))) return area;
  }
  return null;
}

// Schema validator: dropa entries invalidas. Critico pra evitar lixo na UI.
function isValidEstagio(e) {
  if (!e || typeof e !== "object") return false;
  if (typeof e.id !== "string" || !e.id) return false;
  if (typeof e.title !== "string" || !e.title) return false;
  if (typeof e.url !== "string" || !/^https?:\/\//.test(e.url)) return false;
  if (typeof e.source !== "string" || !["adzuna", "jooble", "fixtures"].includes(e.source)) return false;
  return true;
}

// ----------------------------------------------------------------------------
// Adapter: Job (lib/jobs) -> Estagio (este modulo)
// ----------------------------------------------------------------------------

function jobToEstagio(j, source) {
  // Salario do shape Job vem como string "R$ 1.000 - R$ 2.000" ou similar.
  // Parseamos pra numero (max do range, pra ser conservador na heuristica).
  let bolsa = null;
  if (typeof j.salario === "string") {
    const matches = j.salario.match(/[\d.]+/g);
    if (matches && matches.length > 0) {
      const nums = matches
        .map((m) => parseInt(m.replace(/\./g, ""), 10))
        .filter((n) => Number.isFinite(n) && n > 100); // ignora "12" de "12/h"
      if (nums.length > 0) bolsa = Math.max(...nums);
    }
  }
  const uf = extractUf(j.local || "");
  const modalidade = detectModalidade(`${j.titulo || ""} ${j.descricao || ""} ${j.local || ""}`);
  const area = inferArea(j.titulo || "");

  return {
    id: j.id || `${source}-${Math.random().toString(36).slice(2)}`,
    title: String(j.titulo || "").slice(0, 240),
    company: String(j.empresa || "").slice(0, 160),
    location: String(j.local || "").slice(0, 200),
    uf,
    modalidade,
    bolsa,
    area,
    url: typeof j.url === "string" ? j.url : null,
    source,
    postedAt: j.postedAt ? new Date(j.postedAt) : null,
    description: typeof j.descricao === "string" ? j.descricao.slice(0, 300) : null,
  };
}

// ----------------------------------------------------------------------------
// Adzuna provider (com filtro nativo internship)
// ----------------------------------------------------------------------------

async function fetchFromAdzuna({ query, uf, limit }) {
  const id = process.env.ADZUNA_APP_ID;
  const key = process.env.ADZUNA_APP_KEY;
  if (!id || !key) return [];

  // contract_type=internship e o filtro nativo. Combinamos com what=estagio
  // pra ampliar match — algumas vagas nao marcam contract_type mas tem titulo
  // explicito.
  const what = query ? `${query} estagio` : "estagio";
  const where = uf && UF_TO_REGION[uf] ? UF_TO_REGION[uf] : "Brasil";

  const params = new URLSearchParams({
    app_id: id,
    app_key: key,
    results_per_page: String(Math.min(Math.max(limit, 1), 50)),
    what,
    where,
    contract_type: "internship",
    "content-type": "application/json",
  });

  // NAO usa pais=br fixo na URL — o endpoint ja inclui /br/ no path.
  const url = `https://api.adzuna.com/v1/api/jobs/br/search/1?${params.toString()}`;

  let res;
  try {
    res = await withTimeout(url);
  } catch (e) {
    console.error(`estagios.adzuna: fetch falhou — ${e?.message || e}`);
    return [];
  }
  if (!res.ok) {
    // Nao logamos URL completa (contem chave). Apenas status.
    console.error(`estagios.adzuna: status ${res.status}`);
    return [];
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return [];
  }
  const results = Array.isArray(data?.results) ? data.results : [];
  return results.map((r) => ({
    id: `adzuna-est-${r.id || r.adref || Math.random().toString(36).slice(2)}`,
    source: "adzuna",
    titulo: String(r.title || "").slice(0, 240),
    empresa: String(r.company?.display_name || r.company || "").slice(0, 160),
    local: String(r.location?.display_name || "").slice(0, 200),
    url: typeof r.redirect_url === "string" ? r.redirect_url : null,
    descricao: String(r.description || "").slice(0, 4000),
    salario:
      r.salary_min || r.salary_max
        ? `R$ ${Math.round(r.salary_min || r.salary_max)} - R$ ${Math.round(r.salary_max || r.salary_min)}`
        : null,
    postedAt: typeof r.created === "string" ? r.created : null,
  }));
}

// ----------------------------------------------------------------------------
// Jooble provider (sem filtro nativo — keyword + heuristica)
// ----------------------------------------------------------------------------

async function fetchFromJooble({ query, uf, limit }) {
  const apiKey = process.env.JOOBLE_API_KEY;
  if (!apiKey) return [];

  // Sem filtro de contract type — Jooble nao expoe. Estrategia: keyword
  // "estagio" + query do usuario. Heuristica pos-fetch filtra ainda mais.
  const keywords = query ? `estagio ${query}` : "estagio";
  const location = uf && UF_TO_REGION[uf] ? `${UF_TO_REGION[uf]}, Brasil` : "Brasil";

  let res;
  try {
    res = await withTimeout(`https://jooble.org/api/${apiKey}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ keywords, location, page: 1 }),
    });
  } catch (e) {
    console.error(`estagios.jooble: fetch falhou — ${e?.message || e}`);
    return [];
  }
  if (!res.ok) {
    console.error(`estagios.jooble: status ${res.status}`);
    return [];
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return [];
  }
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  return jobs.slice(0, limit).map((j, i) => ({
    id: `jooble-est-${j.id || i}`,
    source: "jooble",
    titulo: String(j.title || "").slice(0, 240),
    empresa: String(j.company || "").slice(0, 160),
    local: String(j.location || "").slice(0, 200),
    url: typeof j.link === "string" ? j.link : null,
    descricao: String(j.snippet || "").replace(/<[^>]+>/g, "").slice(0, 4000),
    salario: j.salary ? String(j.salary).slice(0, 80) : null,
    postedAt: typeof j.updated === "string" ? j.updated : null,
  }));
}

// ----------------------------------------------------------------------------
// Fixtures: catalogo deterministico pra dev sem chave API.
//
// 10 estagios cobrindo areas populares (TI, marketing, financas, RH, design,
// juridico). Bolsa entre R$ 800-2.200 (faixa real do mercado BR 2024 — fonte
// NUBE). Capitais maiores + remoto pra variedade. Empresas ficticias mas
// plausiveis (mesmo padrao de lib/jobs/providers/fixtures.js).
// ----------------------------------------------------------------------------

const FIXTURES = [
  {
    id: "fix-est-ti-be-1",
    title: "Estagio em Desenvolvimento Backend",
    company: "Norte Tecnologia",
    location: "Sao Paulo, SP",
    uf: "SP",
    modalidade: "Híbrido",
    bolsa: 1800,
    area: "ti",
    description: "Estagio em backend com Node.js, JavaScript, Git e REST APIs. Aprendizado em PostgreSQL, Docker e cultura agile. Mentoria semanal, plano de carreira ate junior em 12 meses.",
  },
  {
    id: "fix-est-ti-fe-1",
    title: "Estagiario(a) Frontend React",
    company: "Bossa Studio",
    location: "Remoto (Brasil)",
    uf: null,
    modalidade: "Remoto",
    bolsa: 1500,
    area: "ti",
    description: "Estagio em frontend com React, JavaScript, HTML/CSS e Git. Pareamento com devs senior, code review e cultura de feedback. Curso pago de TypeScript no 3o mes.",
  },
  {
    id: "fix-est-ti-data-1",
    title: "Estagio em Analise de Dados",
    company: "Banco Andorinha",
    location: "Sao Paulo, SP",
    uf: "SP",
    modalidade: "Presencial",
    bolsa: 2000,
    area: "ti",
    description: "Estagio em analise de dados com SQL, Python (Pandas), Excel e Power BI. Projetos reais de risco e credito. VR + VT + plano de saude. Cursos LinkedIn Learning liberados.",
  },
  {
    id: "fix-est-mkt-1",
    title: "Estagiario(a) de Marketing Digital",
    company: "Carioca Midia",
    location: "Rio de Janeiro, RJ",
    uf: "RJ",
    modalidade: "Híbrido",
    bolsa: 1400,
    area: "marketing",
    description: "Estagio em marketing digital com SEO, Google Ads, Meta Ads, Excel e GA4. Atuacao em campanhas reais, briefings com clientes e analise de resultados. Mentoria semanal.",
  },
  {
    id: "fix-est-mkt-content-1",
    title: "Estagio em Conteudo e Redacao",
    company: "Mundo Plural Educacao",
    location: "Remoto (Brasil)",
    uf: null,
    modalidade: "Remoto",
    bolsa: 1200,
    area: "marketing",
    description: "Estagio em criacao de conteudo, copywriting, SEO basico e redes sociais. Atuacao em blog, newsletter e LinkedIn institucional. Para cursando comunicacao, jornalismo ou letras.",
  },
  {
    id: "fix-est-fin-1",
    title: "Estagiario(a) Financeiro",
    company: "Cooperativa Verde",
    location: "Curitiba, PR",
    uf: "PR",
    modalidade: "Presencial",
    bolsa: 1600,
    area: "financas",
    description: "Estagio em FP&A com Excel avancado, conciliacao bancaria, fluxo de caixa e apoio em fechamento mensal. Para cursando administracao, ciencias contabeis ou economia.",
  },
  {
    id: "fix-est-rh-1",
    title: "Estagio em Recursos Humanos",
    company: "Acme do Brasil",
    location: "Belo Horizonte, MG",
    uf: "MG",
    modalidade: "Híbrido",
    bolsa: 1300,
    area: "rh",
    description: "Estagio em RH com apoio em recrutamento, onboarding, eventos internos e comunicacao com colaboradores. Para cursando psicologia, administracao ou areas correlatas.",
  },
  {
    id: "fix-est-juridico-1",
    title: "Estagiario(a) de Direito",
    company: "Banco Andorinha",
    location: "Sao Paulo, SP",
    uf: "SP",
    modalidade: "Presencial",
    bolsa: 2200,
    area: "juridico",
    description: "Estagio juridico com apoio em direito bancario, contratos, LGPD e compliance. Para cursando direito a partir do 5o periodo. OAB nao obrigatoria. VR + VT + plano de saude.",
  },
  {
    id: "fix-est-design-1",
    title: "Estagio em UX/UI Design",
    company: "Hummingbird Tech",
    location: "Remoto (Brasil)",
    uf: null,
    modalidade: "Remoto",
    bolsa: 1700,
    area: "design",
    description: "Estagio em design de produto com Figma, design system, prototipagem e testes de usabilidade. Mentoria de designer senior. Para cursando design grafico, digital ou areas correlatas.",
  },
  {
    id: "fix-est-eng-1",
    title: "Estagio em Engenharia Civil",
    company: "Pampa Agro",
    location: "Porto Alegre, RS",
    uf: "RS",
    modalidade: "Presencial",
    bolsa: 1900,
    area: "engenharia",
    description: "Estagio em engenharia civil com apoio em projetos de infraestrutura, orcamentos e visitas tecnicas a obras. Para cursando engenharia civil a partir do 6o periodo.",
  },
];

function fixturesAsEstagios() {
  return FIXTURES.map((f) => ({
    id: f.id,
    title: f.title,
    company: f.company,
    location: f.location,
    uf: f.uf,
    modalidade: f.modalidade,
    bolsa: f.bolsa,
    area: f.area,
    url: "https://career-twin-ai.vercel.app/estagios", // self-ref pra evitar dead link
    source: "fixtures",
    postedAt: null,
    description: f.description,
  }));
}

// ----------------------------------------------------------------------------
// API principal
// ----------------------------------------------------------------------------

/**
 * Busca estagios filtrando providers Adzuna + Jooble por tipo internship.
 * Sem chaves API -> retorna fixtures (10 estagios curados).
 *
 * @param {object} opts
 * @param {string} [opts.query] Texto livre — area/tecnologia. Ex: "frontend", "marketing".
 * @param {string} [opts.uf]    Sigla UF (AC..TO). Filtra resultados externos + locais.
 * @param {string} [opts.area]  Area normalizada (ti/marketing/...). Filtra local.
 * @param {number} [opts.limit=30] Maximo retornado (1-100).
 * @returns {Promise<Array>} Estagio[] (vazio em erro total).
 */
export async function fetchEstagios({ query = "", uf = "", area = "", limit = 30 } = {}) {
  // Normaliza inputs (defensivo — mesmo se a rota ja sanitizou).
  const queryNorm = typeof query === "string" ? query.trim().slice(0, 120) : "";
  const ufNorm = typeof uf === "string" && /^[A-Za-z]{2}$/.test(uf.trim())
    ? uf.trim().toUpperCase()
    : "";
  const areaNorm = typeof area === "string" ? area.trim().toLowerCase().slice(0, 60) : "";
  const limitNum = Math.max(1, Math.min(100, Number(limit) || 30));

  // Cache key inclui todos os filtros — diferente query/uf/area = bucket diferente.
  const cacheKey = `estagios:v1:${queryNorm}:${ufNorm}:${areaNorm}:${limitNum}`;
  const hit = await cacheGet(cacheKey);
  if (hit) return hit;

  // Detecta se algum provider externo esta configurado. Se nao, vai direto pra fixtures
  // (poupa Promise.allSettled vazio e simplifica o caminho).
  const hasAdzuna = !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);
  const hasJooble = !!process.env.JOOBLE_API_KEY;

  if (!hasAdzuna && !hasJooble) {
    let fixtures = fixturesAsEstagios();
    if (ufNorm) fixtures = fixtures.filter((e) => !e.uf || e.uf === ufNorm);
    if (areaNorm) fixtures = fixtures.filter((e) => !e.area || e.area === areaNorm);
    if (queryNorm) {
      const q = normalize(queryNorm);
      fixtures = fixtures.filter((e) =>
        normalize(`${e.title} ${e.description || ""}`).includes(q)
      );
    }
    const sliced = fixtures.slice(0, limitNum);
    await cacheSet(cacheKey, sliced, CACHE_TTL_MS);
    return sliced;
  }

  // Promise.allSettled — falha de 1 provider nao quebra o outro.
  const tasks = [];
  if (hasAdzuna) tasks.push(fetchFromAdzuna({ query: queryNorm, uf: ufNorm, limit: limitNum }));
  if (hasJooble) tasks.push(fetchFromJooble({ query: queryNorm, uf: ufNorm, limit: limitNum }));

  const results = await Promise.allSettled(tasks);

  const collected = [];
  const sourceByIdx = [];
  if (hasAdzuna) sourceByIdx.push("adzuna");
  if (hasJooble) sourceByIdx.push("jooble");

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (r.status === "fulfilled" && Array.isArray(r.value)) {
      const src = sourceByIdx[i];
      for (const j of r.value) collected.push({ job: j, source: src });
    } else if (r.status === "rejected") {
      console.error(`estagios: provider ${sourceByIdx[i]} rejected — ${r.reason?.message || r.reason}`);
    }
  }

  // Aplica heuristica de internship em cada item ANTES de virar Estagio.
  const filtered = [];
  for (const { job, source } of collected) {
    // Heuristica: keyword no titulo/descricao OU salario baixo + sem CLT/senior.
    // Adzuna ja filtrou via contract_type=internship, mas garantia adicional
    // protege contra match incorreto do API (acontece quando o endpoint nao
    // tem vagas internship suficientes e devolve "proximos").
    let bolsaApprox = null;
    if (typeof job.salario === "string") {
      const m = job.salario.match(/\d[\d.]+/);
      if (m) bolsaApprox = parseInt(m[0].replace(/\./g, ""), 10);
    }
    if (!looksLikeInternship({ titulo: job.titulo, descricao: job.descricao, bolsa: bolsaApprox })) {
      continue;
    }
    filtered.push(jobToEstagio(job, source));
  }

  // Filtros locais (area). UF ja vai como filtro externo + reforco local
  // (alguns providers ignoram where param se area for muito ampla).
  let filteredLocal = filtered;
  if (areaNorm) {
    filteredLocal = filteredLocal.filter((e) => !e.area || e.area === areaNorm);
  }
  if (ufNorm) {
    // UF reforco: se vaga tem UF detectado, exige match. Sem UF detectado, passa
    // (provider externo provavelmente filtrou na origem; nao queremos descartar
    // 100% de "remoto" so porque vem sem UF).
    filteredLocal = filteredLocal.filter((e) => !e.uf || e.uf === ufNorm);
  }

  // Dedupe por (company normalizada + title normalizado). Adzuna e Jooble
  // sindicalizam vagas — frequentemente devolvem a mesma com IDs diferentes.
  const seen = new Set();
  const deduped = [];
  for (const e of filteredLocal) {
    const k = `${normalize(e.company)}|${normalize(e.title)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push(e);
  }

  // Schema: dropa entries quebradas (sem title/url/id). Slice no final.
  const valid = deduped.filter(isValidEstagio).slice(0, limitNum);

  // Se providers retornaram zero estagios validos, faz fallback pra fixtures
  // (UX: melhor mostrar algo ilustrativo do que tela vazia).
  let payload = valid;
  if (payload.length === 0) {
    let fb = fixturesAsEstagios();
    if (ufNorm) fb = fb.filter((e) => !e.uf || e.uf === ufNorm);
    if (areaNorm) fb = fb.filter((e) => !e.area || e.area === areaNorm);
    payload = fb.slice(0, limitNum);
  }

  await cacheSet(cacheKey, payload, CACHE_TTL_MS);
  return payload;
}

// Exportado pra testes — permite assertion direta sem reaplicar heuristica.
export { looksLikeInternship, isValidEstagio, fixturesAsEstagios };
