import { cacheGet, cacheSet, registerInflightClear } from "./cache";
import { searchFixtures } from "./providers/fixtures";

// Carrega os providers reais de forma preguicosa e tolerante: se a chave nao
// estiver no env, o provider simplesmente nao entra na lista — degrada para
// fixtures (rotulado como ilustrativo). NUNCA acessamos chave no cliente.

async function activeProviders() {
  const list = [];
  if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) {
    const { searchAdzuna } = await import("./providers/adzuna");
    list.push({ name: "adzuna", fn: searchAdzuna });
  }
  if (process.env.JOOBLE_API_KEY) {
    const { searchJooble } = await import("./providers/jooble");
    list.push({ name: "jooble", fn: searchJooble });
  }
  if (process.env.GREENHOUSE_BOARDS) {
    const { searchGreenhouse } = await import("./providers/greenhouse");
    list.push({ name: "greenhouse", fn: searchGreenhouse });
  }
  if (process.env.LEVER_BOARDS) {
    const { searchLeverJobs } = await import("./providers/lever");
    list.push({ name: "lever", fn: searchLeverJobs });
  }
  if (process.env.ASHBY_BOARDS) {
    const { searchAshbyJobs } = await import("./providers/ashby");
    list.push({ name: "ashby", fn: searchAshbyJobs });
  }
  if (process.env.WORKABLE_BOARDS) {
    const { searchWorkableJobs } = await import("./providers/workable");
    list.push({ name: "workable", fn: searchWorkableJobs });
  }
  // Gupy: scraping etico via __NEXT_DATA__ dos subdominios de empresa. Opt-in
  // via GUPY_BOARDS (lista de slugs ou "default" pra usar allowlist embutida).
  if (process.env.GUPY_BOARDS) {
    const { searchGupy } = await import("./providers/gupy");
    list.push({ name: "gupy", fn: searchGupy });
  }
  // Vagas.com: HTML SSR limpo. Opt-in via JOBS_ENABLE_VAGAS_COM=1 (defensivo —
  // evita scraping em CI/build sem decisao explicita).
  if (process.env.JOBS_ENABLE_VAGAS_COM) {
    const { searchVagasCom } = await import("./providers/vagas-com");
    list.push({ name: "vagas-com", fn: searchVagasCom });
  }
  return list;
}

function dedupe(jobs) {
  // Deduplica por (titulo|empresa) normalizado — provedores diferentes podem
  // listar a mesma vaga (mesmo titulo + empresa).
  const seen = new Set();
  const out = [];
  for (const j of jobs) {
    const k = `${(j.titulo || "").toLowerCase().trim()}|${(j.empresa || "").toLowerCase().trim()}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(j);
  }
  return out;
}

// Relaxa o termo de busca: remove senioridades e palavras comuns pra
// providers que matcheiam exato ("Engenheiro Backend Pleno" -> "engenheiro
// backend"). Adzuna/Jooble retornam muito mais resultados sem essas palavras.
const NOISE_TOKENS = new Set([
  "junior", "jr", "trainee", "pleno", "mid", "senior", "sr", "lead",
  "principal", "staff", "especialista", "especialist", "manager", "gerente",
  "de", "da", "do", "para", "em", "com", "the", "of", "and", "or",
]);

function relaxRole(role) {
  return String(role || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !NOISE_TOKENS.has(t))
    .slice(0, 3)
    .join(" ")
    .trim();
}

// Single-flight (Gimli 2026-06-30 §5 R-CACHE-STAMPEDE).
// Quando /gaps carrega, page-server + /api/gaps/summary + /api/gaps/requirements
// disparam 3 searchJobs com a MESMA cacheKey (limit=200) antes do primeiro
// cacheSet acontecer. Sem este Map, cada um dispara um fan-out completo de
// providers — 3x quota Adzuna por page-load.
//
// Como funciona: 1a chamada cria a Promise e registra no Map. 2a/3a chamadas
// veem a key, retornam a MESMA Promise (await na mesma execucao). Quando
// resolve/rejeita, o `finally` limpa o Map — falha NAO e memoizada (proxima
// request tenta de novo). Per-instance (cada lambda Vercel tem seu Map), mas
// em Fluid Compute o reuso de instancia cobre o caso comum (single user load
// = single instance).
const _inflight = new Map();

// Permite cacheClear() (usado nos tests) tambem dropar inflight pra evitar
// ghost-promise entre testes que recriam estado.
registerInflightClear(() => _inflight.clear());

export async function searchJobs({ role, location = "Brasil", limit = 3 } = {}) {
  if (!role || typeof role !== "string") {
    return { jobs: await searchFixtures({ role: "vaga", limit }), sources: ["fixtures"] };
  }
  // Cache key inclui versao do schema pra invalidar quando mudamos a logica.
  const cacheKey = `jobs:v2:${role}:${location}:${limit}`;
  const hit = await cacheGet(cacheKey);
  if (hit) return hit;

  // Se ja ha uma busca em voo pra esta key, reusa a Promise.
  const pending = _inflight.get(cacheKey);
  if (pending) return pending;

  const promise = _runSearch({ role, location, limit, cacheKey })
    .finally(() => _inflight.delete(cacheKey));
  _inflight.set(cacheKey, promise);
  return promise;
}

async function _runSearch({ role, location, limit, cacheKey }) {
  const providers = await activeProviders();
  const collected = [];
  const sourcesUsed = [];
  const sourceCounts = {};
  const relaxed = relaxRole(role);

  // Paraleliza os providers ativos. Falha de um nao quebra os outros.
  // Cada provider recebe o role original + a query relaxada como fallback.
  const results = await Promise.allSettled(
    providers.map(async (p) => {
      // Tenta com role completo primeiro, depois relaxado se trouxer pouco.
      let got = await p.fn({ role, location, limit });
      if ((!Array.isArray(got) || got.length < 5) && relaxed && relaxed !== role.toLowerCase().trim()) {
        const more = await p.fn({ role: relaxed, location, limit });
        const arr = Array.isArray(more) ? more : [];
        const seen = new Set((got || []).map((j) => j.id));
        const extra = arr.filter((j) => !seen.has(j.id));
        got = [...(got || []), ...extra];
      }
      return { name: p.name, jobs: Array.isArray(got) ? got : [] };
    })
  );
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.jobs.length > 0) {
      collected.push(...r.value.jobs);
      if (!sourcesUsed.includes(r.value.name)) sourcesUsed.push(r.value.name);
      sourceCounts[r.value.name] = (sourceCounts[r.value.name] || 0) + r.value.jobs.length;
    } else if (r.status === "rejected") {
      console.error("jobs provider falhou:", r.reason?.message);
    }
  }

  // Fixtures so como FALLBACK TOTAL — quando nenhum provider real respondeu.
  // Mesclar pra "completar volume" contaminava a agregacao estatistica do /gaps
  // (algoritmo de aderencia ponderava skills de vagas artificiais como se fossem
  // mercado real). Decisao 2026-06-29 (auditoria Gandalf): preferir N vagas
  // reais do que N+M com M artificial e flag enganosa.
  if (collected.length === 0) {
    const fix = await searchFixtures({ role, limit: Math.max(limit, 8) });
    collected.push(...fix);
    if (fix.length > 0) {
      sourcesUsed.push("fixtures");
      sourceCounts.fixtures = fix.length;
    }
  }

  const merged = dedupe(collected).slice(0, limit);

  // illustrativeRatio = fracao do pool final que veio de fixtures (0..1).
  // Substitui o boolean isIllustrative (mantido pra back-compat — true quando
  // ratio >= 0.5). UI consome o ratio pra calibrar tom da label de transparencia.
  const fixturesInFinal = merged.filter((j) => j?.source === "fixtures").length;
  const illustrativeRatio = merged.length > 0
    ? Number((fixturesInFinal / merged.length).toFixed(2))
    : 0;
  const realCount = merged.length - fixturesInFinal;

  const payload = {
    jobs: merged,
    sources: sourcesUsed,
    counts: sourceCounts,
    illustrativeRatio,
    realCount,
  };
  await cacheSet(cacheKey, payload);
  return payload;
}

export { searchFixtures };
