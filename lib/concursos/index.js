// Provider de Concursos Publicos (BR). Agrega via scraping de pciconcursos.com.br
// — um dos agregadores mais estaveis do mercado, listando ~37k vagas em
// concursos abertos. Foco no CANDIDATO, sem viés de venda de curso.
//
// Scraping ético, sem bypass:
//  - User-Agent identifica o aggregator com URL de contato.
//  - Honra robots.txt (pull no boot, cacheia decisão por hostname).
//  - Rate-limit 1 req/sec por hostname (mutex global no modulo).
//  - Timeout 10s com AbortController.
//  - Cache de 1h por consulta (key inclui UF/nivel/area).
//  - Sem cheerio (regex robusta + parsing manual leve).
//  - Graceful: qualquer erro → []. Nunca quebra a UI.
//
// Por que pciconcursos vs acheconcursos/concursosnobrasil:
//  - pci: HTML estavel ha anos (estrutura .ca/.cd/.ce), robots.txt amigavel
//    (so bloqueia /admin, /pdf, /ebook — nao /concursos), data-url
//    explicito em cada item (link direto pra noticia/edital).
//  - ache: tem GraphQL interno mas exige tokens. Bloqueia /apostilas, /forum.
//  - concursosnobrasil: Wordpress padrao, conteudo bem menos estruturado.
//
// IMPORTANTE: Nunca expomos chaves nem usuario na URL. Toda fonte e publica.
//
// HTML structure que parseamos (exemplo):
//   <div id="SP" class="ua">  <-- marker do estado
//   <div class="na" data-url="https://www.pciconcursos.com.br/noticias/...">
//     <div class="ca"><a href="..." title="...">Orgao Nome</a>
//     <div class="cc">SP</div>
//     <div class="cd">5 vagas até R$ 15.659,70<br><span>Cargo<br><span>Superior</span></span></div>
//     <div class="ce"><span>13/07/2026</span></div>
//   </div>

import { cacheGet, cacheSet } from "@/lib/jobs/cache";

const USER_AGENT = "CareerTwin AI Aggregator (https://career-twin-ai.vercel.app)";
const BASE = "https://www.pciconcursos.com.br";
const TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

// Mapeamento UF → região (necessário pra URL do pciconcursos, que organiza
// listagens por região, com fragments por estado: /concursos/sudeste/#SP).
// Buscar /concursos/ direto cobre todos, mas é mais barato pra UF específica
// hitar a região correspondente (HTML menor).
const UF_REGIAO = {
  AC: "norte", AL: "nordeste", AM: "norte", AP: "norte",
  BA: "nordeste", CE: "nordeste",
  DF: "centrooeste", ES: "sudeste", GO: "centrooeste",
  MA: "nordeste", MG: "sudeste", MS: "centrooeste", MT: "centrooeste",
  PA: "norte", PB: "nordeste", PE: "nordeste", PI: "nordeste", PR: "sul",
  RJ: "sudeste", RN: "nordeste", RO: "norte", RR: "norte", RS: "sul",
  SC: "sul", SE: "nordeste", SP: "sudeste", TO: "norte",
};

const NIVEL_ALIASES = {
  fundamental: ["fundamental", "alfabetizado"],
  medio: ["médio", "medio", "técnico", "tecnico"],
  superior: ["superior", "graduacao", "graduação"],
};

// Rate-limit de 1 req/seg por hostname. Promise-chain simples — cada chamada
// aguarda a anterior + delay. Bypass não trivial mesmo com chamadas paralelas.
let lastRequestPromise = Promise.resolve();
const REQUEST_INTERVAL_MS = 1000;

async function rateLimitedFetch(url, init = {}) {
  const prev = lastRequestPromise;
  let release;
  lastRequestPromise = new Promise((r) => { release = r; });
  try {
    await prev;
    await new Promise((r) => setTimeout(r, REQUEST_INTERVAL_MS));
    return await timedFetch(url, init);
  } finally {
    release();
  }
}

async function timedFetch(url, init = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: ctl.signal,
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml",
        ...(init.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

// Cache da decisão robots.txt por hostname. Buscamos UMA vez no primeiro uso
// e mantemos em memória do processo (vida do lambda). TTL infinito é ok porque
// robots muda raramente; se mudar e bloquear, reciclagem do lambda pega.
const robotsCache = new Map(); // hostname -> { allowed: bool, fetchedAt: number }

async function isAllowedByRobots(targetUrl) {
  const u = new URL(targetUrl);
  const hostname = u.hostname;
  const cached = robotsCache.get(hostname);
  if (cached) return cached.allowed;

  try {
    const res = await timedFetch(`${u.protocol}//${hostname}/robots.txt`);
    if (!res.ok) {
      // robots.txt 404 = sem restrição (RFC 9309). Permite e cacheia.
      robotsCache.set(hostname, { allowed: true, fetchedAt: Date.now() });
      return true;
    }
    const text = await res.text();
    const path = u.pathname;
    // Parsing minimo do robots.txt: encontra bloco User-agent: * e checa Disallow.
    // Não suportamos crawl-delay, sitemaps, ou wildcards complexos — adequado
    // pra "check basico" porque os agregadores tem regras simples.
    const allowed = !isPathDisallowed(text, path);
    robotsCache.set(hostname, { allowed, fetchedAt: Date.now() });
    return allowed;
  } catch (e) {
    console.error(`concursos: robots check falhou (${hostname}):`, e?.message);
    // Defensivo: se nao consigo ler robots, NAO acesso. Honra spirit.
    robotsCache.set(hostname, { allowed: false, fetchedAt: Date.now() });
    return false;
  }
}

function isPathDisallowed(robotsText, path) {
  // Encontra blocos do User-agent: * (ignora outros UAs específicos).
  const blocks = String(robotsText).split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const uas = lines
      .filter((l) => /^user-agent\s*:/i.test(l))
      .map((l) => l.split(":")[1].trim().toLowerCase());
    if (!uas.includes("*")) continue;
    for (const line of lines) {
      const m = line.match(/^disallow\s*:\s*(.*)$/i);
      if (!m) continue;
      const rule = m[1].trim();
      if (!rule) continue; // "Disallow:" vazio = allow all
      // wildcards basicos: $ no final, * pra "qualquer coisa".
      if (rule.endsWith("$")) {
        const prefix = rule.slice(0, -1);
        if (path === prefix) return true;
      } else if (rule.includes("*")) {
        const regex = new RegExp("^" + rule.replace(/\*/g, ".*"));
        if (regex.test(path)) return true;
      } else if (path.startsWith(rule)) {
        return true;
      }
    }
  }
  return false;
}

// Reset usado em testes pra forçar re-check do robots.txt sem state leak.
export function _resetRobotsCache() {
  robotsCache.clear();
}

// -----------------------------------------------------------------------------
// Parsing
// -----------------------------------------------------------------------------

// Extrai o texto puro de HTML (sem tags). Não decodifica entities complexas
// — basta pra display normal e busca textual em pt-BR.
function stripHtml(html) {
  return String(html || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&aacute;/g, "á").replace(/&eacute;/g, "é").replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó").replace(/&uacute;/g, "ú").replace(/&atilde;/g, "ã")
    .replace(/&otilde;/g, "õ").replace(/&ccedil;/g, "ç")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// Hash determinístico (DJB2) curto pra ID estável — não usa crypto pra rodar
// em qualquer runtime (edge/node/test).
function hashId(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return ("00000000" + (h >>> 0).toString(16)).slice(-8);
}

// Extrai número (vagas) do texto "5 vagas até R$ X". Aceita ponto/virgula.
function parseVagas(text) {
  const m = String(text || "").match(/(\d{1,3}(?:[.,]\d{3})*|\d+)\s*vaga/i);
  if (!m) return null;
  const n = parseInt(m[1].replace(/[.,]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

// Extrai 1 ou 2 valores de salario em R$ do texto. "até R$ 5.000,00" → max only.
// "de R$ 2.000 a R$ 5.000" → min+max. "R$ X,YY" sempre interpretado com vírgula
// como decimal (padrao BR).
function parseSalario(text) {
  const t = String(text || "");
  // Pegamos todos os "R$ NNN.NNN,NN" do texto
  const re = /R\$\s*([\d.,]+)/gi;
  const valores = [];
  let m;
  while ((m = re.exec(t)) !== null) {
    const raw = m[1];
    // Remove pontos (milhar) e troca vírgula por ponto (decimal).
    const cleaned = raw.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    if (Number.isFinite(n)) valores.push(n);
  }
  if (valores.length === 0) return { salarioMin: null, salarioMax: null };
  if (valores.length === 1) return { salarioMin: null, salarioMax: valores[0] };
  return { salarioMin: Math.min(...valores), salarioMax: Math.max(...valores) };
}

// Detecta nível a partir do texto extraído do .cd. PciConcursos lista
// "Ensino Médio", "Superior", "Médio / Técnico / Superior", "Fundamental".
// Retornamos o nível MAIS ALTO encontrado pra match com filtro do usuario
// (quem busca "medio" aceita uma vaga que pede Medio+Superior, ja que pode
// concorrer pelas vagas de medio).
function parseNivel(text) {
  const lower = String(text || "").toLowerCase();
  if (/superior|gradua/i.test(lower)) return "Superior";
  if (/m[eé]dio|t[eé]cnico/i.test(lower)) return "Médio";
  if (/fundamental|alfabetiz/i.test(lower)) return "Fundamental";
  return null;
}

// Parse de data DD/MM/AAAA → Date. Aceita "DD a DD/MM/AAAA" (janela): pegamos
// o segundo (limite final). Aceita "DD/MM" (sem ano): assume ano corrente
// (ou próximo se ja passou).
function parseInscricoesAte(text) {
  const t = String(text || "").trim();
  if (!t) return null;
  // Padrao "DD a DD/MM/AAAA" - usamos o último DD
  const range = t.match(/(\d{1,2})\s+a\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (range) {
    const [, , d2, m, y] = range;
    return safeDate(parseInt(y), parseInt(m) - 1, parseInt(d2));
  }
  // Padrao "DD/MM/AAAA"
  const full = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (full) {
    const [, d, m, y] = full;
    return safeDate(parseInt(y), parseInt(m) - 1, parseInt(d));
  }
  // Padrao "DD/MM" — assume ano corrente
  const short = t.match(/(\d{1,2})\/(\d{1,2})/);
  if (short) {
    const [, d, m] = short;
    const now = new Date();
    return safeDate(now.getUTCFullYear(), parseInt(m) - 1, parseInt(d));
  }
  return null;
}

function safeDate(y, m, d) {
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (y < 2000 || y > 2099) return null;
  if (m < 0 || m > 11 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m, d));
  return Number.isNaN(dt.getTime()) ? null : dt;
}

// Parser principal: HTML completo → array de Concurso.
// Estratégia: regex pra blocos <div class="na|da|ea" data-url="..."> que sao
// um concurso. Não usa cheerio (sem dep nova, build leve).
export function parsePciHtml(html, { ufFiltro = null } = {}) {
  if (typeof html !== "string" || html.length === 0) return [];

  // Encontra TODOS os blocos de concurso. Regex tolerante a quebras de linha
  // e ordem variavel de atributos. Match nao-greedy ate <div class="clear">
  // que sempre encerra o item nas paginas que parseamos.
  const blockRegex = /<div\s+class="(?:na|da|ea)"[^>]*data-url="([^"]+)"[^>]*>([\s\S]*?)<div\s+class="clear">/gi;
  const out = [];
  let match;
  while ((match = blockRegex.exec(html)) !== null) {
    const url = match[1];
    const body = match[2];
    const item = parseBlock(body, url);
    if (!item) continue;
    if (ufFiltro && item.uf && item.uf !== ufFiltro) continue;
    out.push(item);
  }
  return out;
}

function parseBlock(body, url) {
  // .ca: link com órgão (texto dentro do <a>)
  const caMatch = body.match(/<div\s+class="ca">\s*<a[^>]*>([\s\S]*?)<\/a>/i);
  const orgaoRaw = caMatch ? stripHtml(caMatch[1]) : "";
  if (!orgaoRaw) return null;

  // .cc: UF (estado de 2 letras) ou "NACIONAL". Pode estar vazio.
  const ccMatch = body.match(/<div\s+class="cc">([\s\S]*?)<\/div>/i);
  let uf = ccMatch ? stripHtml(ccMatch[1]).trim().toUpperCase() : null;
  if (uf && !/^[A-Z]{2}$/.test(uf)) uf = null;

  // .cd: bloco com vagas, salário, cargo e nivel (multi-linha com <br> e <span>)
  const cdMatch = body.match(/<div\s+class="cd">([\s\S]*?)<\/div>/i);
  const cdRaw = cdMatch ? cdMatch[1] : "";
  const cdText = stripHtml(cdRaw);

  // .ce: prazo de inscrição (pode ter <span>DD a DD/MM/AAAA</span>)
  const ceMatch = body.match(/<div\s+class="ce">([\s\S]*?)<\/div>/i);
  const ceText = ceMatch ? stripHtml(ceMatch[1]) : "";

  // .cd pode ter "Vagas + Salário<br><span>Cargo<br><span>Nivel</span></span>"
  // Extraímos cargo do PRIMEIRO span; o texto antes do span tem vagas+salário.
  let cargo = "Vários Cargos";
  const spanMatch = cdRaw.match(/<span[^>]*>([\s\S]*?)<span/i);
  if (spanMatch) {
    cargo = stripHtml(spanMatch[1]) || cargo;
  }

  const vagas = parseVagas(cdText);
  const { salarioMin, salarioMax } = parseSalario(cdText);
  const nivel = parseNivel(cdText);
  const inscricoesAte = parseInscricoesAte(ceText);

  // ID estavel baseado em url (que ja e unico por concurso na fonte).
  const id = `pci-${hashId(url)}`;

  return {
    id,
    orgao: orgaoRaw.slice(0, 240),
    cargo: (cargo || "Vários Cargos").slice(0, 240),
    nivel,
    vagas,
    salarioMin,
    salarioMax,
    uf,
    inscricoesAte,
    url,
    taxa: null, // não disponível na listagem
    banca: null, // não disponível na listagem
  };
}

// Valida schema do Concurso. Dropa entries com faltas críticas.
export function isValidConcurso(c) {
  if (!c || typeof c !== "object") return false;
  if (typeof c.id !== "string" || !c.id) return false;
  if (typeof c.orgao !== "string" || !c.orgao) return false;
  if (typeof c.url !== "string" || !/^https?:\/\//.test(c.url)) return false;
  return true;
}

// -----------------------------------------------------------------------------
// Fetch principal
// -----------------------------------------------------------------------------

/**
 * Busca concursos publicos abertos do agregador pciconcursos.com.br.
 *
 * @param {object} opts
 * @param {string} [opts.uf]      Sigla UF (AC..TO). Filtra pelos concursos do estado.
 * @param {string} [opts.nivel]   "fundamental" | "medio" | "superior".
 * @param {string} [opts.area]    Texto livre — busca em cargo/orgao.
 * @param {number} [opts.limit=30] Máximo retornado.
 * @returns {Promise<Array>} Concurso[] (vazio em erro ou sem matches).
 */
export async function fetchConcursos({ uf, nivel, area, limit = 30 } = {}) {
  // Normaliza inputs (defensivo)
  const ufNorm = typeof uf === "string" && /^[A-Z]{2}$/i.test(uf.trim())
    ? uf.trim().toUpperCase()
    : null;
  const nivelNorm = typeof nivel === "string" ? nivel.toLowerCase().trim() : null;
  const areaNorm = typeof area === "string" ? area.toLowerCase().trim() : null;
  const limitNorm = Math.max(1, Math.min(100, Number(limit) || 30));

  const cacheKey = `concursos:${ufNorm || "all"}:${nivelNorm || "all"}:${areaNorm || "all"}`;
  const hit = await cacheGet(cacheKey);
  if (hit) return hit;

  // Define URL alvo. Com UF, prefere /concursos/{regiao}/ (menor + mais focado).
  // Sem UF, vai pra /concursos/ (lista geral).
  let targetUrl;
  if (ufNorm && UF_REGIAO[ufNorm]) {
    targetUrl = `${BASE}/concursos/${UF_REGIAO[ufNorm]}/`;
  } else {
    targetUrl = `${BASE}/concursos/`;
  }

  try {
    // Robots.txt check antes de tudo. Cacheia decisao por hostname.
    const allowed = await isAllowedByRobots(targetUrl);
    if (!allowed) {
      console.warn("concursos: robots.txt bloqueia", targetUrl);
      await cacheSet(cacheKey, [], CACHE_TTL_MS);
      return [];
    }

    const res = await rateLimitedFetch(targetUrl);
    if (!res.ok) {
      console.error(`concursos: fetch falhou (${res.status})`, targetUrl);
      await cacheSet(cacheKey, [], CACHE_TTL_MS);
      return [];
    }
    const html = await res.text();

    let items = parsePciHtml(html, { ufFiltro: ufNorm });

    // Filtro de nível (post-parse: nem todos os items têm .nivel, então os
    // sem-nivel passam sempre, evita over-filter).
    if (nivelNorm && NIVEL_ALIASES[nivelNorm]) {
      const aliases = NIVEL_ALIASES[nivelNorm];
      items = items.filter((c) => {
        if (!c.nivel) return true;
        const n = c.nivel.toLowerCase();
        return aliases.some((a) => n.includes(a));
      });
    }

    // Filtro de área (texto livre em cargo + orgao).
    if (areaNorm) {
      items = items.filter((c) => {
        const hay = `${c.cargo} ${c.orgao}`.toLowerCase();
        return hay.includes(areaNorm);
      });
    }

    // Valida schema (drop entries broken) + corta no limit.
    const valid = items.filter(isValidConcurso).slice(0, limitNorm);

    await cacheSet(cacheKey, valid, CACHE_TTL_MS);
    return valid;
  } catch (e) {
    console.error("concursos: erro inesperado:", e?.message);
    return [];
  }
}

/**
 * Busca detalhe de um concurso por ID. Atualmente não suportado — o ID é hash
 * da URL fonte; o usuário acessa o detalhe direto via Concurso.url. Mantemos
 * a função pra compatibilidade futura, retornando null sempre.
 *
 * @deprecated Use Concurso.url pra navegar até o edital/inscrição.
 */
export async function fetchConcursoById(_id) {
  return null;
}
