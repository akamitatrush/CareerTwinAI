// Vagas.com Provider — scraping ETICO de paginas publicas de busca.
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
//   Vagas.com retorna HTML SSR completo em `/vagas-de-{role}`.
//   Cada vaga vem em <li class="vaga (even|odd)"> com markup estavel:
//     - h2.cargo > a.link-detalhes-vaga (titulo + href + data-id-vaga)
//     - span.emprVaga (empresa)
//     - div.vaga-local (cidade/UF)
//     - div.detalhes > p (snippet de descricao)
//     - span.nivelVaga (Junior/Pleno/Senior)
//     - span.data-publicacao (data ou "Ha N dias")

import { cacheGet, cacheSet } from "../cache";

const HOST = "www.vagas.com.br";
const BASE = `https://${HOST}`;
const TIMEOUT_MS = 8000;
const USER_AGENT =
  "CareerTwin AI Job Aggregator (https://career-twin-ai.vercel.app)";

// === robots.txt cache em memoria ===
const robotsCache = new Map();
const ROBOTS_TTL_MS = 24 * 60 * 60 * 1000;

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
    robotsCache.set(host, { fetchedAt: Date.now(), rules: [] });
    return [];
  }
}

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

// === Rate-limit: 1 req/sec ===
let lastFetch = 0;
async function rateLimit() {
  const delta = Date.now() - lastFetch;
  if (delta < 1000) await new Promise((r) => setTimeout(r, 1000 - delta));
  lastFetch = Date.now();
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

// Vagas.com usa /vagas-de-{role-slug} — converte "Engenheiro de Dados" -> "engenheiro-de-dados".
function roleToSlug(role) {
  return norm(role)
    .replace(/[^a-z0-9 -]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function stripHtml(s) {
  return String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

// "Ha 6 dias" / "11/06/2026" → ISO 8601 string ou null.
// Mantemos a string original como fallback pra UI.
function parsePostedAt(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  // dd/mm/yyyy
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
    return iso;
  }
  // "Ha N dias|hora|min" — converte aproximado pra ISO.
  const rel = s.match(/h[aá]\s+(\d+)\s+(dia|hora|min)/i);
  if (rel) {
    const n = parseInt(rel[1], 10);
    const unit = rel[2].toLowerCase();
    const ms =
      unit.startsWith("dia") ? n * 86400000
      : unit.startsWith("hora") ? n * 3600000
      : n * 60000;
    return new Date(Date.now() - ms).toISOString().slice(0, 10);
  }
  return null;
}

// Extrai cada <li class="vaga (even|odd)"> e parseia campos.
// Regex robusta — usa `data-id-vaga` como chave (atributo dedicado, dificil mudar).
function parseListings(html) {
  const out = [];
  const re = /<li[^>]*class="vaga (?:even|odd)[^"]*"[^>]*>([\s\S]+?)<\/li>/g;
  let match;
  while ((match = re.exec(html))) {
    const block = match[1];
    const idM = block.match(/data-id-vaga="(\d+)"/);
    const hrefM = block.match(
      /<a class="link-detalhes-vaga"[^>]*href="([^"]+)"/
    );
    const titleM = block.match(
      /<a class="link-detalhes-vaga"[^>]*title="([^"]+)"/
    );
    const empresaM = block.match(
      /<span class="emprVaga">([\s\S]*?)<\/span>/
    );
    const localM = block.match(
      /<div class="vaga-local">[\s\S]*?<\/i>\s*([^<\n]+?)(?:\s*<|<\/div>)/
    );
    const detalhesM = block.match(
      /<div class="detalhes">\s*<p>([\s\S]+?)<\/p>/
    );
    const nivelM = block.match(
      /<span class="nivelVaga">\s*([^<]+?)\s*<\/span>/
    );
    const dataM = block.match(
      /<span class="data-publicacao">[^<]*<i[^>]*><\/i>\s*([^<]+)\s*<\/span>/
    );

    if (!idM || !hrefM || !titleM) continue; // shape minimo: id + url + titulo
    const id = idM[1];
    const href = hrefM[1];
    const url = href.startsWith("http") ? href : `${BASE}${href}`;
    const titulo = decodeEntities(titleM[1]).slice(0, 240);
    const empresa = empresaM
      ? decodeEntities(stripHtml(empresaM[1])).slice(0, 160)
      : "Confidencial";
    const local = localM
      ? decodeEntities(stripHtml(localM[1])).slice(0, 200)
      : "Brasil";
    const detalhes = detalhesM
      ? decodeEntities(stripHtml(detalhesM[1])).slice(0, 500)
      : null;
    const nivel = nivelM ? stripHtml(nivelM[1]) : null;
    const dataPub = dataM ? parsePostedAt(dataM[1]) : null;

    // Concatena nivel ao titulo na descricao se houver — alimenta extractSkills.
    const descricao = detalhes
      ? nivel
        ? `${nivel} — ${detalhes}`.slice(0, 500)
        : detalhes
      : null;

    out.push({
      id: `vagas-com-${id}`,
      source: "vagas-com",
      titulo,
      empresa,
      local,
      url,
      descricao,
      salario: null, // Vagas.com nao expoe salario na lista
      postedAt: dataPub,
    });
  }
  return out;
}

export async function searchVagasCom({ role, location, limit = 3 } = {}) {
  // Sem role → nao tem como construir URL. Retorna vazio (caller fallback fixtures).
  const slug = roleToSlug(role);
  if (!slug || slug.length < 3) return [];

  const cacheKey = `jobs:vagas-com:${slug}:${norm(location || "")}`;
  const hit = await cacheGet(cacheKey);
  if (hit && Array.isArray(hit)) {
    return hit.slice(0, limit);
  }

  // robots.txt — bail se Disallow cobre o path de busca.
  const rules = await getRobotsRules(HOST);
  const path = `/vagas-de-${slug}`;
  if (pathDisallowed(rules, path)) {
    console.warn("[jobs-vagas-com] robots.txt disallow", path);
    return [];
  }

  await rateLimit();
  let html = "";
  try {
    const res = await withTimeout(`${BASE}${path}`);
    if (!res.ok) {
      console.warn("[jobs-vagas-com] status", res.status);
      return [];
    }
    html = await res.text();
  } catch (e) {
    console.warn("[jobs-vagas-com] fetch falhou:", e?.message);
    return [];
  }

  const all = parseListings(html);
  // Valida shape minimo + dedup local por id (regex pode capturar overlap em tags aninhadas).
  const seen = new Set();
  const filtered = [];
  for (const j of all) {
    if (!j.titulo || !j.url) continue;
    if (seen.has(j.id)) continue;
    seen.add(j.id);
    filtered.push(j);
  }

  await cacheSet(cacheKey, filtered);
  return filtered.slice(0, limit);
}

export const __test = {
  parseListings,
  parsePostedAt,
  roleToSlug,
  pathDisallowed,
  parseRobotsDisallows,
  USER_AGENT,
};
