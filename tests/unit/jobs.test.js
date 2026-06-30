import { describe, it, expect, beforeEach } from "vitest";
import { searchJobs, searchFixtures } from "@/lib/jobs";
import { cacheClear } from "@/lib/jobs/cache";

describe("lib/jobs — fallback ilustrativo", () => {
  beforeEach(() => {
    cacheClear();
    delete process.env.ADZUNA_APP_ID;
    delete process.env.ADZUNA_APP_KEY;
    delete process.env.JOOBLE_API_KEY;
    delete process.env.GREENHOUSE_BOARDS;
    // Sem UPSTASH_*, cache cai pra Map em-memoria — comportamento esperado em CI.
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("sem nenhuma chave, cai em fixtures rotulado", async () => {
    const r = await searchJobs({ role: "Engenheiro de Dados", limit: 3 });
    expect(r.sources).toEqual(["fixtures"]);
    expect(r.jobs.length).toBeGreaterThan(0);
    for (const j of r.jobs) {
      expect(j.source).toBe("fixtures");
      expect(j.url).toBeNull(); // fixtures nao linka
    }
  });

  it("e deterministico por role (mesma seed)", async () => {
    const a = await searchJobs({ role: "Product Manager", limit: 3 });
    cacheClear();
    const b = await searchJobs({ role: "Product Manager", limit: 3 });
    expect(a.jobs.map((j) => j.empresa)).toEqual(b.jobs.map((j) => j.empresa));
  });

  it("respeita o cache: 2a chamada nao re-gera", async () => {
    const a = await searchJobs({ role: "QA", limit: 3 });
    const b = await searchJobs({ role: "QA", limit: 3 });
    expect(a).toBe(b); // mesma referencia (cacheado em memoria, mem-store guarda objeto)
  });

  it("role vazio nao quebra", async () => {
    const r = await searchJobs({});
    expect(r.jobs.length).toBeGreaterThan(0);
  });
});

describe("searchJobs — single-flight (Gimli G2 2026-06-30)", () => {
  beforeEach(() => {
    cacheClear();
    delete process.env.ADZUNA_APP_ID;
    delete process.env.ADZUNA_APP_KEY;
    delete process.env.JOOBLE_API_KEY;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("3 chamadas concorrentes pra mesma key resolvem pro MESMO payload (single-flight)", async () => {
    // Sem providers externos, sai pelo fallback de fixtures — mas o
    // single-flight garante que apenas UMA execucao monta o payload e os 3
    // awaiters compartilham a mesma referencia resolvida. Sem o Map de
    // inflight, cada chamada construiria seu proprio array e objeto.
    const [r1, r2, r3] = await Promise.all([
      searchJobs({ role: "Engenheiro de Dados", limit: 3 }),
      searchJobs({ role: "Engenheiro de Dados", limit: 3 }),
      searchJobs({ role: "Engenheiro de Dados", limit: 3 }),
    ]);
    // Identity equality — se nao fosse single-flight, cada chamada criaria
    // payload novo (jobs.length pode ate ser igual, mas refs distintas).
    expect(r2).toBe(r1);
    expect(r3).toBe(r1);
  });

  it("chamadas com keys distintas NAO compartilham resultado", async () => {
    const [a, b] = await Promise.all([
      searchJobs({ role: "Product Manager", limit: 3 }),
      searchJobs({ role: "Designer", limit: 3 }),
    ]);
    expect(a).not.toBe(b);
  });

  it("apos resolver, inflight e limpo e proxima chamada usa cache", async () => {
    const r1 = await searchJobs({ role: "QA", limit: 3 });
    // 2a chamada vem do cache (mesma referencia salva), nao de uma Promise
    // pendurada no Map de inflight.
    const r2 = await searchJobs({ role: "QA", limit: 3 });
    expect(r2).toBe(r1);
  });
});

describe("searchFixtures", () => {
  it("retorna vagas relevantes pra um role conhecido", async () => {
    const out = await searchFixtures({ role: "Designer", limit: 3 });
    // Catalogo curado pode ter <N fixtures pra esse role — limit e teto, nao piso.
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThanOrEqual(3);
    for (const j of out) {
      expect(j.titulo).toContain("Designer");
      expect(j.source).toBe("fixtures");
    }
  });
});

describe("searchJobs — role nicho sem cobertura (Gimli G3 2026-06-30)", () => {
  beforeEach(() => {
    cacheClear();
    delete process.env.ADZUNA_APP_ID;
    delete process.env.ADZUNA_APP_KEY;
    delete process.env.JOOBLE_API_KEY;
    delete process.env.GREENHOUSE_BOARDS;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  it("role nicho (fisioterapeuta) retorna jobs=[] e flag noRelevantFixtures=true", async () => {
    // Sem providers reais E role fora das 20 categorias do catalogo:
    // searchFixtures retorna [] (decisao de produto: honestidade > preencher
    // com 8 vagas de Backend). Caller seta noRelevantFixtures=true pra UI.
    // Nota: evitar roles com substrings curtas tipo "ia/ai/ux/ml" — o algo
    // de match casa por substring sem word-boundary (limitacao conhecida).
    const r = await searchJobs({ role: "fisioterapeuta esportivo", limit: 8 });
    expect(r.jobs).toEqual([]);
    expect(r.noRelevantFixtures).toBe(true);
    expect(r.illustrativeRatio).toBe(0);
    expect(r.sources).toEqual([]);
  });

  it("role conhecido (Designer) continua retornando fixtures + noRelevantFixtures=false", async () => {
    const r = await searchJobs({ role: "Designer", limit: 8 });
    expect(r.jobs.length).toBeGreaterThan(0);
    expect(r.noRelevantFixtures).toBe(false);
    expect(r.sources).toEqual(["fixtures"]);
    expect(r.illustrativeRatio).toBe(1);
  });

  it("role conhecido limitado (Designer, limit=3) retorna ate 3 fixtures relevantes", async () => {
    const r = await searchJobs({ role: "Designer", limit: 3 });
    expect(r.jobs.length).toBeGreaterThan(0);
    expect(r.jobs.length).toBeLessThanOrEqual(3);
    expect(r.noRelevantFixtures).toBe(false);
    for (const j of r.jobs) {
      expect(j.source).toBe("fixtures");
    }
  });
});
