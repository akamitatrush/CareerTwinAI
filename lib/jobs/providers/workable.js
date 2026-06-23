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

function jobMatchesRole(job, role) {
  const roleTokens = tokenize(role);
  if (!roleTokens.length) return true;
  const hay = tokenize([job.title, job.department].filter(Boolean).join(" "));
  return roleTokens.some((t) => hay.includes(t));
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

  const filtered = all.filter((j) => {
    // Reaplica matchers no shape ja normalizado.
    const [city = "", country = ""] = String(j.local || "").split(",").map((s) => s.trim());
    const fakeRaw = { title: j.titulo, city, country };
    return jobMatchesRole(fakeRaw, role) && isBrazil(fakeRaw);
  });

  filtered.sort((a, b) => (b.postedAt || "").localeCompare(a.postedAt || ""));
  return filtered.slice(0, limit);
}

// Alias compatibilidade — mantem o padrao `searchWorkable` igual aos outros.
export { searchWorkableJobs as searchWorkable };
