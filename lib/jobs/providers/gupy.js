// Gupy Provider — scraping ETICO de paginas publicas de Career Hub.
//
// COMPLIANCE:
//   - Identifica User-Agent (CareerTwin AI Job Aggregator).
//   - Honra robots.txt (cache em memoria, 1x por boot).
//   - Cache 10min via lib/jobs/cache.js (Redis em prod, Map em-memoria fallback).
//   - Rate-limit interno: 1 req/sec por host.
//   - Timeout 8s com AbortController.
//   - SEM bypass, SEM login, SEM cookies de sessao.
//   - Apenas dados publicos da pagina HTML SSR.
//
// ESTRATEGIA:
//   O portal central gupy.io/job-search e SPA pura (jobs vem via API privada).
//   Mas cada empresa-cliente tem subdominio `{slug}.gupy.io` (Career Hub) que
//   renderiza SSR com `__NEXT_DATA__.props.pageProps.jobs[]` populado — a mesma
//   tecnica que motores de busca usam pra indexar.
//
//   Configura via env GUPY_BOARDS="lojasrenner,ipiranga,..." (slug do subdominio).
//   Defaults razoaveis se nao setado: 6 empresas BR conhecidas que usam Gupy.
//
//   Job na pagina tem shape: { id, title, department, workplace: { address, workplaceType } }
//   URL canonica: https://{slug}.gupy.io/jobs/{id}?jobBoardSource=gupy_public_page

import { cacheGet, cacheSet } from "../cache";

const TIMEOUT_MS = 8000;
const MAX_BOARDS = 12;
const USER_AGENT =
  "CareerTwin AI Job Aggregator (https://career-twin-ai.vercel.app)";

// Subdominios conhecidos com Career Hub publico (validados em 2026-06).
// Cada subdominio pode ter centenas de vagas — selecionamos os mais ativos.
const DEFAULT_BOARDS = [
  "lojasrenner",
  "americanas",
  "bemol",
  "cogna",
  "gpa",
  "ambev",
  "embraer",
  "riachuelo",
  "ipiranga",
];

// === robots.txt cache em memoria (1 fetch por boot por host) ===
const robotsCache = new Map(); // host -> { fetchedAt, rules: string[] }
const ROBOTS_TTL_MS = 24 * 60 * 60 * 1000; // 24h

async function getRobotsRules(host) {
  const cached = robotsCache.get(host);
  if (cached && Date.now() - cached.fetchedAt < ROBOTS_TTL_MS) {
    return cached.rules;
  }
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    let txt = "";
    try {
      const r = await fetch(`https://${host}/robots.txt`, {
        signal: ctl.signal,
        headers: { "user-agent": USER_AGENT, accept: "text/plain" },
      });
      if (r.ok) txt = await r.text();
    } finally {
      clearTimeout(t);
    }
    const rules = parseRobotsDisallows(txt);
    robotsCache.set(host, { fetchedAt: Date.now(), rules });
    return rules;
  } catch {
    // Falha de rede: assume permissivo (mesmo que crawler tradicional).
    robotsCache.set(host, { fetchedAt: Date.now(), rules: [] });
    return [];
  }
}

// Extrai Disallow do bloco User-agent: * (ignora outros UAs).
// Crawler legitimo identifica-se com UA generico → so cabecalho `*` se aplica.
function parseRobotsDisallows(text) {
  const lines = String(text || "").split(/\r?\n/);
  const out = [];
  let inStar = false;
  for (const raw of lines) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "user-agent") {
      inStar = val === "*";
    } else if (inStar && key === "disallow" && val) {
      out.push(val);
    }
  }
  return out;
}

function pathDisallowed(rules, path) {
  if (!rules.length) return false;
  for (const rule of rules) {
    // Suporta wildcard simples `*` (cobre `*?*foo=*`). Sem suporte a $ end-anchor
    // porque os patterns do gupy.io usam wildcard em qualquer posicao.
    if (rule === "/") return true;
    if (rule.includes("*")) {
      const re = new RegExp(
        "^" + rule.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")
      );
      if (re.test(path)) return true;
    } else if (path.startsWith(rule)) {
      return true;
    }
  }
  return false;
}

// === Rate-limit interno: 1 req/sec por host ===
const lastFetchByHost = new Map();
async function rateLimit(host) {
  const last = lastFetchByHost.get(host) || 0;
  const delta = Date.now() - last;
  if (delta < 1000) {
    await new Promise((r) => setTimeout(r, 1000 - delta));
  }
  lastFetchByHost.set(host, Date.now());
}

async function withTimeout(url) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: ctl.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml",
      },
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
  const hay = tokenize(
    [job.title, job.department].filter(Boolean).join(" ")
  );
  return roleTokens.some((t) => hay.includes(t));
}

function workplaceToLocal(wp) {
  const addr = wp?.address || {};
  const wpType = wp?.workplaceType;
  const parts = [addr.city, addr.stateShortName || addr.state].filter(
    (p) => typeof p === "string" && p.trim()
  );
  let base = parts.length ? parts.join(", ") : "Brasil";
  if (wpType === "remote") base += " (Remoto)";
  else if (wpType === "hybrid") base += " (Hibrido)";
  return base.slice(0, 200);
}

function capitalize(s) {
  const str = String(s || "");
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Extrai JSON do <script id="__NEXT_DATA__" type="application/json">...</script>.
// Sem DOM parser — regex com bounds tolerantes (atributos podem reordenar).
function extractNextData(html) {
  const m = String(html || "").match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]+?)<\/script>/
  );
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function shape(rawJob, subdomain, careerPage) {
  if (!rawJob || typeof rawJob.title !== "string" || typeof rawJob.id !== "number")
    return null;
  const empresa =
    String(
      careerPage?.publicationName || careerPage?.name || subdomain
    ).slice(0, 160) || capitalize(subdomain);
  return {
    id: `gupy-${subdomain}-${rawJob.id}`,
    source: "gupy",
    titulo: String(rawJob.title || "").slice(0, 240),
    empresa,
    local: workplaceToLocal(rawJob.workplace),
    url: `https://${subdomain}.gupy.io/jobs/${rawJob.id}?jobBoardSource=gupy_public_page`,
    // Lista nao expoe descricao (pagina detalhe redireciona via JS) — concatena
    // department + tipo de trabalho pra que extractSkills tenha algum contexto.
    descricao: [rawJob.department, rawJob.workplace?.workplaceType]
      .filter(Boolean)
      .join(" — ")
      .slice(0, 500),
    salario: null, // Gupy nao expoe salario na lista publica
    postedAt: null, // ditto
  };
}

async function fetchBoard(subdomain) {
  const host = `${subdomain}.gupy.io`;
  // 1) robots.txt — se Disallow cobre "/" ou path raiz, bail out.
  const rules = await getRobotsRules(host);
  if (pathDisallowed(rules, "/")) {
    console.warn("[jobs-gupy] robots.txt disallow", host);
    return [];
  }
  // 2) Rate-limit por host.
  await rateLimit(host);
  // 3) Fetch SSR HTML.
  let html = "";
  try {
    const res = await withTimeout(`https://${host}/`);
    if (!res.ok) {
      // 404 e comum em subdominios desativados — log curto, sem stack.
      console.warn("[jobs-gupy]", host, "status", res.status);
      return [];
    }
    html = await res.text();
  } catch (e) {
    console.warn("[jobs-gupy]", host, "fetch falhou:", e?.message);
    return [];
  }
  // 4) Parse __NEXT_DATA__.
  const data = extractNextData(html);
  if (!data) {
    console.warn("[jobs-gupy]", host, "sem __NEXT_DATA__");
    return [];
  }
  const pp = data?.props?.pageProps || {};
  const jobs = Array.isArray(pp.jobs) ? pp.jobs : [];
  const career = pp.careerPage || {};
  return jobs.map((j) => shape(j, subdomain, career)).filter(Boolean);
}

export async function searchGupy({ role, location, limit = 3 } = {}) {
  // Lista de boards via env. "default" usa allowlist embutida (DEFAULT_BOARDS).
  // Whitelist de chars contra SSRF — qualquer slug fora do padrao e descartado.
  const raw = (process.env.GUPY_BOARDS || "").trim();
  if (!raw) return [];
  const fromEnv =
    raw.toLowerCase() === "default"
      ? DEFAULT_BOARDS
      : raw
          .split(",")
          .map((s) => s.trim())
          .filter((s) => /^[a-z0-9._-]{1,80}$/i.test(s));
  const boards = fromEnv.slice(0, MAX_BOARDS);
  if (!boards.length) return [];

  const cacheKey = `jobs:gupy:${norm(role || "")}:${norm(location || "")}:${boards.join(",")}`;
  const hit = await cacheGet(cacheKey);
  if (hit && Array.isArray(hit)) {
    // Aplica limit no cache hit tambem — caller pode pedir limite menor que o cacheado.
    return hit.slice(0, limit);
  }

  // Fan-out paralelo, falha por board NAO derruba os outros.
  const results = await Promise.allSettled(boards.map(fetchBoard));
  const all = [];
  for (const r of results) {
    if (r.status === "fulfilled" && Array.isArray(r.value)) {
      all.push(...r.value);
    }
  }

  // Filtra por role + valida shape minimo.
  const filtered = all.filter((j) => {
    if (!j || !j.titulo || !j.url) return false;
    return jobMatchesRole({ title: j.titulo, department: j.descricao }, role);
  });

  // Cache TODA a lista filtrada (sem slice) — caller decide o limite.
  await cacheSet(cacheKey, filtered);
  return filtered.slice(0, limit);
}

// Helpers exportados pra testes — facilitam mock de robots/parser.
export const __test = {
  extractNextData,
  shape,
  workplaceToLocal,
  pathDisallowed,
  parseRobotsDisallows,
  USER_AGENT,
};
