import { cacheGet, cacheSet } from "./cache";
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

export async function searchJobs({ role, location = "Brasil", limit = 3 } = {}) {
  if (!role || typeof role !== "string") {
    return { jobs: await searchFixtures({ role: "vaga", limit }), sources: ["fixtures"] };
  }
  const cacheKey = `jobs:${role}:${location}:${limit}`;
  const hit = cacheGet(cacheKey);
  if (hit) return hit;

  const providers = await activeProviders();
  const collected = [];
  const sourcesUsed = [];

  // Paraleliza os providers ativos. Falha de um nao quebra os outros.
  const results = await Promise.allSettled(
    providers.map(async (p) => {
      const got = await p.fn({ role, location, limit });
      return { name: p.name, jobs: Array.isArray(got) ? got : [] };
    })
  );
  for (const r of results) {
    if (r.status === "fulfilled" && r.value.jobs.length > 0) {
      collected.push(...r.value.jobs);
      if (!sourcesUsed.includes(r.value.name)) sourcesUsed.push(r.value.name);
    } else if (r.status === "rejected") {
      console.error("jobs provider falhou:", r.reason?.message);
    }
  }

  // Sem provider real ou ninguem trouxe nada → fixtures (rotulado).
  if (collected.length === 0) {
    const fix = await searchFixtures({ role, limit });
    const payload = { jobs: fix, sources: ["fixtures"] };
    cacheSet(cacheKey, payload);
    return payload;
  }

  const merged = dedupe(collected).slice(0, limit);
  const payload = { jobs: merged, sources: sourcesUsed };
  cacheSet(cacheKey, payload);
  return payload;
}

export { searchFixtures };
