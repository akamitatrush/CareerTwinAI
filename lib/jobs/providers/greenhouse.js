// Greenhouse Job Board API: https://boards-api.greenhouse.io/v1/boards/{board}/jobs
// Sem autenticacao — sao boards publicos. Cada empresa-alvo e um board.
// Configura via env GREENHOUSE_BOARDS="empresa1,empresa2,..." (slug do board).

const TIMEOUT_MS = 8000;

async function withTimeout(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctl.signal, headers: { accept: "application/json" } });
  } finally {
    clearTimeout(t);
  }
}

function tokenize(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// Tokens de senioridade/conectivo que NAO discriminam role — strippados
// pra evitar "marketing manager" bater "Customer Success Manager" so pelo
// "manager". Em sync com lib/skills-taxonomy.js ROLE_NOISE_TOKENS.
const NOISE_TOKENS = new Set([
  "junior", "jr", "trainee", "pleno", "mid", "senior", "sr", "lead",
  "principal", "staff", "especialista", "especialist", "manager", "gerente",
  "de", "da", "do", "para", "em", "com", "the", "of", "and", "or",
  "i", "ii", "iii", "iv",
]);

// Decisao P0.6 (po-oportunidades-auditoria.md §P0.6 + §4.5):
// `roleTokens.some(...)` puro virou OR-bug: "marketing manager" batia qualquer
// vaga com "manager" no titulo. Strippamos noise primeiro; se sobra >=1 token
// funcional, exigimos que UM deles bate (mantem recall). Se nao sobra nada
// (role e so noise tipo "Senior" sozinho — caso degenerado), fallback pro
// some() original com TODOS os tokens. Mais conservador que `every()` (que
// derrubaria casos como "Backend Engineer" vs titulo "Backend Developer").
//
// Retorno expandido: { matches, hits } pra permitir RANKING posterior por
// quantidade de tokens batidos (mais hits = mais aderencia). Caller usa
// para sort dentro da lista filtrada.
function jobMatchesRole(job, role) {
  const role_tokens = tokenize(role);
  if (!role_tokens.length) return { matches: true, hits: 0 };
  const hay = tokenize(job.title);
  const requiredTokens = role_tokens.filter((t) => !NOISE_TOKENS.has(t));
  const matchSet = requiredTokens.length ? requiredTokens : role_tokens;
  let hits = 0;
  for (const t of matchSet) if (hay.includes(t)) hits++;
  return { matches: hits > 0, hits };
}

function stripHtml(s) {
  return String(s || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

async function fetchBoard(board) {
  // Slug controlado por env (lista de allowlist) — nunca usa input de usuario aqui.
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(
    board
  )}/jobs?content=true`;
  const res = await withTimeout(url);
  if (!res.ok) {
    console.error("greenhouse:", board, "status", res.status);
    return [];
  }
  const data = await res.json();
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
  return jobs.map((j) => ({
    id: `greenhouse-${board}-${j.id}`,
    source: "greenhouse",
    titulo: String(j.title || "").slice(0, 240),
    empresa: String(j.company_name || board).slice(0, 160),
    local: String(j.location?.name || "").slice(0, 200),
    url: typeof j.absolute_url === "string" ? j.absolute_url : null,
    descricao: stripHtml(j.content).slice(0, 4000),
    salario: null,
    postedAt: typeof j.updated_at === "string" ? j.updated_at : null,
  }));
}

export async function searchGreenhouse({ role, limit = 3 }) {
  const raw = (process.env.GREENHOUSE_BOARDS || "").trim();
  if (!raw) return [];
  // Aceita "a,b,c". Whitelist de chars para evitar truques.
  const boards = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[a-z0-9._-]{1,80}$/i.test(s));
  if (!boards.length) return [];

  const results = await Promise.allSettled(boards.map(fetchBoard));
  const all = [];
  for (const r of results) {
    if (r.status === "fulfilled") all.push(...r.value);
  }
  // P0.6: avalia roleMatch UMA vez (custo: 2 tokenize por vaga) e usa hits
  // pra ranquear — vaga com mais tokens funcionais batidos vai pro topo.
  // Empate em hits → mais recente primeiro (postedAt desc).
  const scored = all
    .map((j) => ({ job: j, role: jobMatchesRole(j, role) }))
    .filter((x) => x.role.matches);
  scored.sort((a, b) => {
    if (b.role.hits !== a.role.hits) return b.role.hits - a.role.hits;
    return (b.job.postedAt || "").localeCompare(a.job.postedAt || "");
  });
  return scored.slice(0, limit).map((x) => x.job);
}
