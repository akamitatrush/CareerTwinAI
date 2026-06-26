// Tests do provider lib/estagios.
//
// Cobertura (10 casos):
//  1. Sem chaves API (Adzuna+Jooble) -> retorna fixtures determinisicas.
//  2. Mock Adzuna: parser extrai estagios corretamente do shape API.
//  3. Filtro UF aplicado na URL externa (Adzuna where=...) + filtro local de UF.
//  4. Filtro area aplicado localmente em fixtures (sem provider externo).
//  5. Schema validado: isValidEstagio dropa entries sem title/url/id.
//  6. Cache hit: 2a chamada com mesma key NAO refaz fetch.
//  7. Adzuna 500 + Jooble OK -> merge ok (Promise.allSettled tolerante).
//  8. Timeout -> [] (queda graciosa, sem throw).
//  9. Dedupe por (company normalizada + title normalizada).
// 10. Heuristica looksLikeInternship: keyword no titulo OU bolsa baixa s/ CLT.
//
// Mocks: fetch global; cache via cacheClear entre testes.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchEstagios,
  looksLikeInternship,
  isValidEstagio,
  fixturesAsEstagios,
} from "@/lib/estagios";
import { cacheClear } from "@/lib/jobs/cache";

// Shape de resposta Adzuna BR /jobs/br/search/1 — campos relevantes.
function adzunaResponse(jobs) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ count: jobs.length, results: jobs }),
    text: async () => JSON.stringify({ results: jobs }),
  };
}

function joobleResponse(jobs) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ totalCount: jobs.length, jobs }),
    text: async () => JSON.stringify({ jobs }),
  };
}

const ADZUNA_SAMPLE = [
  {
    id: "111",
    title: "Estagio em Desenvolvimento Frontend",
    company: { display_name: "Tropical Tech" },
    location: { display_name: "Sao Paulo, SP" },
    redirect_url: "https://example.com/vaga/111",
    description: "Vaga de estagio em frontend com React e JavaScript. Bolsa R$ 1.500.",
    salary_min: 1500,
    salary_max: 1500,
    created: "2026-06-01T10:00:00Z",
  },
  {
    id: "222",
    title: "Estagiario(a) de Marketing Digital",
    company: { display_name: "Carioca Midia" },
    location: { display_name: "Rio de Janeiro, RJ" },
    redirect_url: "https://example.com/vaga/222",
    description: "Estagio em marketing digital com SEO e Google Ads. Bolsa R$ 1.200.",
    salary_min: 1200,
    salary_max: 1200,
    created: "2026-06-02T10:00:00Z",
  },
];

const JOOBLE_SAMPLE = [
  {
    id: "j-1",
    title: "Estagio em Analise de Dados",
    company: "Banco Andorinha",
    location: "Sao Paulo, SP",
    link: "https://example.com/jooble/1",
    snippet: "Programa de estagio em analise de dados. Bolsa R$ 2.000.",
    salary: "R$ 2.000",
    updated: "2026-06-03T10:00:00Z",
  },
];

beforeEach(() => {
  cacheClear();
  delete process.env.ADZUNA_APP_ID;
  delete process.env.ADZUNA_APP_KEY;
  delete process.env.JOOBLE_API_KEY;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
});

describe("lib/estagios — fixtures (sem chave API)", () => {
  it("retorna fixtures determinisicas quando nenhum provider configurado", async () => {
    // Sem ADZUNA_APP_ID nem JOOBLE_API_KEY -> ramo de fixtures.
    const items = await fetchEstagios({ limit: 30 });
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
    // Schema basico das fixtures
    for (const e of items) {
      expect(typeof e.id).toBe("string");
      expect(typeof e.title).toBe("string");
      expect(typeof e.company).toBe("string");
      expect(e.source).toBe("fixtures");
    }
    // Determinismo: 2a chamada (mesmo cache) devolve a MESMA sequencia.
    const items2 = await fetchEstagios({ limit: 30 });
    expect(items2.map((e) => e.id)).toEqual(items.map((e) => e.id));
  });

  it("filtro area aplica em fixtures (apenas TI quando area=ti)", async () => {
    const items = await fetchEstagios({ area: "ti", limit: 30 });
    expect(items.length).toBeGreaterThan(0);
    for (const e of items) {
      expect(e.area).toBe("ti");
    }
  });
});

describe("lib/estagios — Adzuna provider", () => {
  it("parser extrai estagios com schema completo e UF detectada de 'Cidade, SP'", async () => {
    process.env.ADZUNA_APP_ID = "test-id";
    process.env.ADZUNA_APP_KEY = "test-key";
    globalThis.fetch = vi.fn(async () => adzunaResponse(ADZUNA_SAMPLE));

    const items = await fetchEstagios({ limit: 30 });
    // 2 vagas Adzuna passam pela heuristica (titulo contem "estagio").
    expect(items.length).toBe(2);
    const fe = items.find((i) => i.title.includes("Frontend"));
    expect(fe).toBeDefined();
    expect(fe.company).toBe("Tropical Tech");
    expect(fe.location).toBe("Sao Paulo, SP");
    expect(fe.uf).toBe("SP");
    expect(fe.bolsa).toBe(1500);
    expect(fe.source).toBe("adzuna");
    expect(fe.url).toMatch(/^https:\/\//);
    expect(fe.area).toBe("ti"); // inferido do titulo "Frontend"
  });

  it("filtro uf=SP gera URL externa com where=Sao Paulo + filtra resultados sem UF SP", async () => {
    process.env.ADZUNA_APP_ID = "test-id";
    process.env.ADZUNA_APP_KEY = "test-key";
    globalThis.fetch = vi.fn(async () => adzunaResponse(ADZUNA_SAMPLE));

    await fetchEstagios({ uf: "SP", limit: 30 });
    const calls = globalThis.fetch.mock.calls.map((c) => String(c[0]));
    // URL deve conter where=Sao+Paulo (encode) ou where=Sao%20Paulo + contract_type=internship.
    expect(calls.length).toBe(1);
    const url = calls[0];
    expect(url).toMatch(/where=S[a%]/i); // tolera encoding
    expect(url).toMatch(/contract_type=internship/);
  });

  it("filtro UF descarta vagas com UF detectada diferente", async () => {
    process.env.ADZUNA_APP_ID = "test-id";
    process.env.ADZUNA_APP_KEY = "test-key";
    globalThis.fetch = vi.fn(async () => adzunaResponse(ADZUNA_SAMPLE));

    // ADZUNA_SAMPLE tem 1 SP + 1 RJ. Filtro UF=SP local descarta o RJ.
    const items = await fetchEstagios({ uf: "SP", limit: 30 });
    expect(items.length).toBe(1);
    expect(items[0].uf).toBe("SP");
  });
});

describe("lib/estagios — isValidEstagio (schema)", () => {
  it("dropa entries sem id, title, url valida ou source invalida", () => {
    expect(isValidEstagio(null)).toBe(false);
    expect(isValidEstagio({})).toBe(false);
    expect(
      isValidEstagio({ id: "x", title: "T", url: "not-http", source: "adzuna" })
    ).toBe(false);
    expect(
      isValidEstagio({ id: "x", title: "", url: "https://x.com", source: "adzuna" })
    ).toBe(false);
    expect(
      isValidEstagio({ id: "x", title: "T", url: "https://x.com", source: "outro" })
    ).toBe(false);
    expect(
      isValidEstagio({ id: "x", title: "T", url: "https://x.com", source: "fixtures" })
    ).toBe(true);
  });
});

describe("lib/estagios — heuristica looksLikeInternship", () => {
  it("detecta keyword 'estag' no titulo", () => {
    expect(
      looksLikeInternship({ titulo: "Estagio Backend", descricao: "", bolsa: null })
    ).toBe(true);
    expect(
      looksLikeInternship({ titulo: "Internship Frontend", descricao: "", bolsa: null })
    ).toBe(true);
    expect(
      looksLikeInternship({ titulo: "Trainee Marketing", descricao: "", bolsa: null })
    ).toBe(true);
  });

  it("aceita bolsa baixa (<= 2500) sem keyword apenas se NAO tiver indicio CLT/senior", () => {
    expect(
      looksLikeInternship({ titulo: "Analista", descricao: "vaga junior", bolsa: 2000 })
    ).toBe(true);
    // Mesmo bolsa baixa, se titulo bate "senior" / "pleno" / "CLT" -> NAO e estagio.
    expect(
      looksLikeInternship({ titulo: "Analista Senior", descricao: "", bolsa: 2000 })
    ).toBe(false);
    expect(
      looksLikeInternship({ titulo: "Analista Pleno CLT", descricao: "", bolsa: 2000 })
    ).toBe(false);
  });

  it("salario alto sem keyword nao e estagio", () => {
    expect(
      looksLikeInternship({ titulo: "Engenheiro Backend", descricao: "vaga", bolsa: 8000 })
    ).toBe(false);
  });
});

describe("lib/estagios — cache", () => {
  it("2a chamada com mesma key NAO refaz fetch externo", async () => {
    process.env.ADZUNA_APP_ID = "test-id";
    process.env.ADZUNA_APP_KEY = "test-key";
    globalThis.fetch = vi.fn(async () => adzunaResponse(ADZUNA_SAMPLE));

    const a = await fetchEstagios({ limit: 30 });
    const callsAfter1 = globalThis.fetch.mock.calls.length;
    const b = await fetchEstagios({ limit: 30 });
    const callsAfter2 = globalThis.fetch.mock.calls.length;
    expect(callsAfter2).toBe(callsAfter1); // nenhum fetch novo
    expect(b.map((e) => e.id)).toEqual(a.map((e) => e.id));
  });
});

describe("lib/estagios — resiliencia (Promise.allSettled, timeout)", () => {
  it("Adzuna 500 + Jooble OK -> merge tolerante (vagas do Jooble passam)", async () => {
    process.env.ADZUNA_APP_ID = "test-id";
    process.env.ADZUNA_APP_KEY = "test-key";
    process.env.JOOBLE_API_KEY = "jooble-key";

    globalThis.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes("adzuna.com")) {
        return {
          ok: false,
          status: 500,
          json: async () => ({}),
          text: async () => "internal error",
        };
      }
      // jooble.org/api/...
      return joobleResponse(JOOBLE_SAMPLE);
    });

    const items = await fetchEstagios({ limit: 30 });
    // Jooble retorna 1 vaga com "estagio" -> passa heuristica.
    expect(items.length).toBeGreaterThanOrEqual(1);
    const sources = new Set(items.map((e) => e.source));
    expect(sources.has("jooble")).toBe(true);
    expect(sources.has("adzuna")).toBe(false);
  });

  it("timeout (fetch throw) em ambos providers -> fallback pra fixtures (nao tela vazia)", async () => {
    process.env.ADZUNA_APP_ID = "test-id";
    process.env.ADZUNA_APP_KEY = "test-key";

    // Fetch sempre throws -> withTimeout repassa erro -> provider retorna [].
    globalThis.fetch = vi.fn(async () => {
      throw new Error("fetch failed (timeout / abort)");
    });

    const items = await fetchEstagios({ limit: 30 });
    // Sem resultados validos do provider -> fallback pra fixtures (UX defendida).
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].source).toBe("fixtures");
  });
});

describe("lib/estagios — dedupe", () => {
  it("dedupa por (company, title) normalizado quando providers sindicalizam vaga", async () => {
    process.env.ADZUNA_APP_ID = "test-id";
    process.env.ADZUNA_APP_KEY = "test-key";
    process.env.JOOBLE_API_KEY = "jooble-key";

    const dupTitulo = "Estagio em Desenvolvimento Backend";
    const dupEmpresa = "Norte Tecnologia";

    const adzunaDup = [
      {
        id: "a-1",
        title: dupTitulo,
        company: { display_name: dupEmpresa },
        location: { display_name: "Sao Paulo, SP" },
        redirect_url: "https://example.com/a/1",
        description: "Estagio backend",
        salary_min: 1500,
        salary_max: 1500,
        created: "2026-06-01",
      },
    ];
    const joobleDup = [
      {
        id: "j-1",
        title: dupTitulo, // mesma vaga, fonte diferente
        company: dupEmpresa,
        location: "Sao Paulo, SP",
        link: "https://example.com/j/1",
        snippet: "Estagio backend",
        salary: "R$ 1500",
        updated: "2026-06-01",
      },
      {
        id: "j-2",
        title: "Estagio em Marketing", // distinto -> nao dedupa
        company: "Outra Empresa",
        location: "Rio de Janeiro, RJ",
        link: "https://example.com/j/2",
        snippet: "Estagio marketing",
        salary: "R$ 1200",
        updated: "2026-06-01",
      },
    ];

    globalThis.fetch = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes("adzuna.com")) return adzunaResponse(adzunaDup);
      return joobleResponse(joobleDup);
    });

    const items = await fetchEstagios({ limit: 30 });
    // 1 dup (Adzuna) + 2 Jooble = 3 entradas brutas; dedupe deve ficar com 2.
    expect(items.length).toBe(2);
    // A primeira ocorrencia (Adzuna) deve persistir; Jooble da mesma vaga e dropada.
    const sources = items.map((e) => e.source).sort();
    expect(sources).toEqual(["adzuna", "jooble"]);
  });
});

describe("lib/estagios — fixturesAsEstagios export", () => {
  it("expoe fixtures para uso externo (catalogo deterministico)", () => {
    const all = fixturesAsEstagios();
    expect(Array.isArray(all)).toBe(true);
    expect(all.length).toBeGreaterThanOrEqual(10);
    for (const e of all) {
      expect(e.source).toBe("fixtures");
      expect(isValidEstagio(e)).toBe(true);
    }
  });
});
