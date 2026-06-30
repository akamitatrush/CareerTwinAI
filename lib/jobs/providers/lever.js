// Lever Postings API: https://api.lever.co/v0/postings/{company}?mode=json
// Sem autenticacao — sao boards publicos do Lever. Cobertura BR: Hotmart,
// Quero Educacao, Onfly, e varias scaleups que usam Lever em vez de Greenhouse.
// Configura via env LEVER_BOARDS="slug1,slug2,..." (slug do board no Lever).

const BASE = "https://api.lever.co/v0/postings";
const TIMEOUT_MS = 4000; // Lever pode ser lento; 4s por board, em paralelo
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
  const hay = tokenize(
    [job.text, job.categories?.team, job.categories?.department].filter(Boolean).join(" ")
  );
  const requiredTokens = roleTokens.filter((t) => !NOISE_TOKENS.has(t));
  const matchSet = requiredTokens.length ? requiredTokens : roleTokens;
  let hits = 0;
  for (const t of matchSet) if (hay.includes(t)) hits++;
  return { matches: hits > 0, hits };
}

function isBrazil(job) {
  // Conservador: aceita Brasil/Brazil, cidades-chave BR e marcadores de remoto.
  // Quando a localidade vem vazia (board sem categoria), aceitamos tambem —
  // melhor falso-positivo do que descartar vaga util. O filtro de role ainda corta.
  const loc = norm(job.categories?.location || job.country || "");
  if (!loc) return true;
  return (
    loc.includes("brasil") ||
    loc.includes("brazil") ||
    loc.includes("sao paulo") ||
    loc.includes("rio de janeiro") ||
    loc.includes("rio ") ||
    loc.endsWith("rio") ||
    loc.includes("belo horizonte") ||
    loc.includes("curitiba") ||
    loc.includes("porto alegre") ||
    loc.includes("florianopolis") ||
    loc.includes("recife") ||
    loc.includes("salvador") ||
    loc.includes("fortaleza") ||
    loc.includes("brasilia") ||
    loc.includes("campinas") ||
    loc.includes("remoto") ||
    loc.includes("remote") ||
    loc.includes("latam") ||
    loc.includes("latin america")
  );
}

function capitalize(s) {
  const str = String(s || "");
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function shape(job, board) {
  return {
    id: `lever-${board}-${job.id}`,
    source: "lever",
    titulo: String(job.text || "").slice(0, 240),
    empresa: capitalize(board).slice(0, 160),
    local: String(job.categories?.location || "Brasil").slice(0, 200),
    url: typeof job.hostedUrl === "string" ? job.hostedUrl : (job.applyUrl || null),
    descricao: String(job.descriptionPlain || job.description || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 4000),
    salario: null, // Lever nao expoe salario na API publica
    postedAt:
      typeof job.createdAt === "number"
        ? new Date(job.createdAt).toISOString()
        : null,
  };
}

async function fetchBoard(board) {
  const url = `${BASE}/${encodeURIComponent(board)}?mode=json`;
  try {
    const res = await withTimeout(url);
    if (!res.ok) {
      console.error("lever:", board, "status", res.status);
      return [];
    }
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map((j) => shape(j, board));
  } catch (e) {
    // Falha de UM board nao deve cancelar os outros — apenas loga e segue.
    console.error("lever:", board, "falhou:", e?.message);
    return [];
  }
}

export async function searchLeverJobs({ role, limit = 3 }) {
  const raw = (process.env.LEVER_BOARDS || "").trim();
  if (!raw) return [];
  // Whitelist de chars para evitar SSRF/path-traversal via slug.
  const boards = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9._-]{1,80}$/i.test(s))
    .slice(0, MAX_BOARDS);
  if (!boards.length) return [];

  const results = await Promise.allSettled(boards.map(fetchBoard));
  const all = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }

  // P0.6: avaliamos jobMatchesRole UMA vez por vaga e ranqueamos por hits
  // (mais tokens funcionais batidos = topo). Empate -> postedAt desc.
  const scored = all
    .map((j) => {
      const fakeRaw = { text: j.titulo, categories: { location: j.local } };
      return { job: j, role: jobMatchesRole(fakeRaw, role), br: isBrazil(fakeRaw) };
    })
    .filter((x) => x.role.matches && x.br);
  scored.sort((a, b) => {
    if (b.role.hits !== a.role.hits) return b.role.hits - a.role.hits;
    return (b.job.postedAt || "").localeCompare(a.job.postedAt || "");
  });
  return scored.slice(0, limit).map((x) => x.job);
}

// Alias compatibilidade — Greenhouse expoe `searchGreenhouse`, Adzuna
// `searchAdzuna`. Manter `searchLever` tambem facilita seguir o padrao no index.
export { searchLeverJobs as searchLever };
