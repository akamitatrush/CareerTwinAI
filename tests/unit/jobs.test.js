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
