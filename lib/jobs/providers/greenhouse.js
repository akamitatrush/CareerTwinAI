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

function jobMatchesRole(job, role) {
  const role_tokens = tokenize(role);
  if (!role_tokens.length) return true;
  const hay = tokenize(job.title);
  return role_tokens.some((t) => hay.includes(t));
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
  const filtered = all.filter((j) => jobMatchesRole(j, role));
  // Mais recentes primeiro.
  filtered.sort((a, b) => (b.postedAt || "").localeCompare(a.postedAt || ""));
  return filtered.slice(0, limit);
}
