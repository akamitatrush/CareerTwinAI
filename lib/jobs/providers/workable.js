// Workable Public API: https://apply.workable.com/api/v3/accounts/{account}/jobs?state=published
// Sem autenticacao — sao job boards publicos do Workable. Cobertura BR:
// Olist, Onfly parcial e outras scaleups que usam Workable em vez de
// Greenhouse/Lever. Configura via env WORKABLE_BOARDS="acc1,acc2,...".

const BASE = "https://apply.workable.com/api/v3/accounts";
const TIMEOUT_MS = 4000; // por account, em paralelo
const MAX_BOARDS = 20; // cap pra evitar abuse / fan-out excessivo

async function withTimeout(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: ctl.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
  } finally {
    clearTimeout(t);
  }
}

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function tokenize(s) {
  return norm(s)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// Tokens de senioridade/conectivo que NAO discriminam role (P0.6).
// Em sync com lib/skills-taxonomy.js ROLE_NOISE_TOKENS.
const NOISE_TOKENS = new Set([
  "junior", "jr", "trainee", "pleno", "mid", "senior", "sr", "lead",
  "principal", "staff", "especialista", "especialist", "manager", "gerente",
  "de", "da", "do", "para", "em", "com", "the", "of", "and", "or",
  "i", "ii", "iii", "iv",
]);

// P0.6 (po-oportunidades-auditoria.md §P0.6): strippamos noise antes do
// some() pra exigir match num token FUNCIONAL. Retorna {matches, hits}
// pra permitir ranking — mais tokens batidos sobe no sort.
function jobMatchesRole(job, role) {
  const roleTokens = tokenize(role);
  if (!roleTokens.length) return { matches: true, hits: 0 };
  const hay = tokenize([job.title, job.department].filter(Boolean).join(" "));
  const requiredTokens = roleTokens.filter((t) => !NOISE_TOKENS.has(t));
  const matchSet = requiredTokens.length ? requiredTokens : roleTokens;
  let hits = 0;
  for (const t of matchSet) if (hay.includes(t)) hits++;
  return { matches: hits > 0, hits };
}

function isBrazil(job) {
  // Conservador: country=BR/Brazil ou cidade BR-key, plus marcadores remoto.
  // Country vazio + city vazio -> aceita (filtro de role corta o ruido).
  const city = norm(job.city || "");
  const country = norm(job.country || job.country_code || "");
  if (job.telecommuting === true) return true;
  if (norm(job.workplace || "") === "remote") return true;
  if (country === "br" || country.includes("brasil") || country.includes("brazil"))
    return true;
  if (!country && !city) return true;
  return (
    city.includes("sao paulo") ||
    city.includes("rio de janeiro") ||
    city.includes("rio ") ||
    city.endsWith("rio") ||
    city.includes("belo horizonte") ||
    city.includes("curitiba") ||
    city.includes("porto alegre") ||
    city.includes("florianopolis") ||
    city.includes("recife") ||
    city.includes("salvador") ||
    city.includes("fortaleza") ||
    city.includes("brasilia") ||
    city.includes("campinas") ||
    city.includes("remoto") ||
    city.includes("remote") ||
    city.includes("latam")
  );
}

function capitalize(s) {
  const str = String(s || "");
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function stripHtml(s) {
  return String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function shape(job, account) {
  const localParts = [job.city, job.country].filter((p) => typeof p === "string" && p.trim());
  return {
    id: `workable-${account}-${job.id || job.shortcode}`,
    source: "workable",
    titulo: String(job.title || "").slice(0, 240),
    empresa: capitalize(account).slice(0, 160),
    local: (localParts.length ? localParts.join(", ") : "Brasil").slice(0, 200),
    url:
      typeof job.url === "string"
        ? job.url
        : (typeof job.application_url === "string" ? job.application_url : null),
    descricao: stripHtml(job.description).slice(0, 4000),
    salario: null, // Workable nao expoe salario na API publica
    postedAt:
      typeof job.published_on === "string"
        ? job.published_on
        : (typeof job.created_at === "string" ? job.created_at : null),
  };
}

async function fetchBoard(account) {
  // Account controlado por env (allowlist) — nunca usa input de usuario aqui.
  const url = `${BASE}/${encodeURIComponent(account)}/jobs?state=published`;
  try {
    const res = await withTimeout(url);
    if (!res.ok) {
      console.error("workable:", account, "status", res.status);
      return [];
    }
    const data = await res.json();
    const jobs = Array.isArray(data?.results) ? data.results : [];
    return jobs.map((j) => shape(j, account));
  } catch (e) {
    // Falha de UM account nao deve cancelar os outros — apenas loga e segue.
    console.error("workable:", account, "falhou:", e?.message);
    return [];
  }
}

export async function searchWorkableJobs({ role, limit = 3 }) {
  const raw = (process.env.WORKABLE_BOARDS || "").trim();
  if (!raw) return [];
  // Whitelist de chars para evitar SSRF/path-traversal via slug.
  const accounts = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9._-]{1,80}$/i.test(s))
    .slice(0, MAX_BOARDS);
  if (!accounts.length) return [];

  const results = await Promise.allSettled(accounts.map(fetchBoard));
  const all = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }

  // P0.6: ranqueamos por hits funcionais (mais tokens batidos = topo).
  const scored = all
    .map((j) => {
      const [city = "", country = ""] = String(j.local || "").split(",").map((s) => s.trim());
      const fakeRaw = { title: j.titulo, city, country };
      return { job: j, role: jobMatchesRole(fakeRaw, role), br: isBrazil(fakeRaw) };
    })
    .filter((x) => x.role.matches && x.br);
  scored.sort((a, b) => {
    if (b.role.hits !== a.role.hits) return b.role.hits - a.role.hits;
    return (b.job.postedAt || "").localeCompare(a.job.postedAt || "");
  });
  return scored.slice(0, limit).map((x) => x.job);
}

// Alias compatibilidade — mantem o padrao `searchWorkable` igual aos outros.
export { searchWorkableJobs as searchWorkable };
