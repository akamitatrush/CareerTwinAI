import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cacheClear } from "@/lib/jobs/cache";

const SAMPLE_HTML = readFileSync(
  path.resolve(__dirname, "../fixtures/vagas-com-sample.html"),
  "utf8"
);

const ROBOTS_OK = "User-agent: *\nAllow: /";
const ROBOTS_BLOCK = "User-agent: *\nDisallow: /";
const ROBOTS_BLOCK_VAGAS = "User-agent: *\nDisallow: /vagas-de-engenheiro";

function makeOkResponse(body, contentType = "text/html") {
  return {
    ok: true,
    status: 200,
    text: async () => body,
    json: async () => JSON.parse(body),
    headers: { get: () => contentType },
  };
}

function makeErrResponse(status) {
  return {
    ok: false,
    status,
    text: async () => "",
    json: async () => ({}),
    headers: { get: () => "text/html" },
  };
}

describe("vagas-com provider", () => {
  let fetchSpy;

  beforeEach(() => {
    cacheClear();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    if (fetchSpy) fetchSpy.mockRestore();
    fetchSpy = null;
    vi.resetModules();
  });

  it("role vazio retorna [] sem fetch", async () => {
    fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(makeOkResponse(""));
    const { searchVagasCom } = await import("@/lib/jobs/providers/vagas-com");
    expect(await searchVagasCom({ role: "", limit: 5 })).toEqual([]);
    expect(await searchVagasCom({ role: "ab", limit: 5 })).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("HTML SSR valido extrai jobs com schema correto", async () => {
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).endsWith("/robots.txt"))
        return makeOkResponse(ROBOTS_OK, "text/plain");
      return makeOkResponse(SAMPLE_HTML);
    });
    const { searchVagasCom } = await import("@/lib/jobs/providers/vagas-com");
    const jobs = await searchVagasCom({ role: "engenheiro", limit: 10 });
    expect(jobs.length).toBeGreaterThanOrEqual(3);
    for (const j of jobs) {
      expect(j.source).toBe("vagas-com");
      expect(typeof j.titulo).toBe("string");
      expect(j.titulo.length).toBeGreaterThan(0);
      expect(j.url).toMatch(/^https:\/\/www\.vagas\.com\.br\/vagas\/v\d+/);
      expect(j.id).toMatch(/^vagas-com-\d+/);
      expect(j.salario).toBeNull();
      expect(typeof j.local).toBe("string");
    }
  });

  it("extrai postedAt em formato dd/mm/yyyy", async () => {
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).endsWith("/robots.txt"))
        return makeOkResponse(ROBOTS_OK, "text/plain");
      return makeOkResponse(SAMPLE_HTML);
    });
    const { searchVagasCom } = await import("@/lib/jobs/providers/vagas-com");
    const jobs = await searchVagasCom({ role: "engenheiro", limit: 10 });
    const withDate = jobs.find((j) => j.postedAt);
    expect(withDate).toBeTruthy();
    expect(withDate.postedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("HTML malformado (sem <li class='vaga'>) retorna [] sem throw", async () => {
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).endsWith("/robots.txt"))
        return makeOkResponse(ROBOTS_OK, "text/plain");
      return makeOkResponse("<html><body><p>nothing here</p></body></html>");
    });
    const { searchVagasCom } = await import("@/lib/jobs/providers/vagas-com");
    const jobs = await searchVagasCom({ role: "engenheiro", limit: 5 });
    expect(jobs).toEqual([]);
  });

  it("fetch retorna 500 → array vazio sem throw", async () => {
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).endsWith("/robots.txt"))
        return makeOkResponse(ROBOTS_OK, "text/plain");
      return makeErrResponse(500);
    });
    const { searchVagasCom } = await import("@/lib/jobs/providers/vagas-com");
    const jobs = await searchVagasCom({ role: "engenheiro", limit: 5 });
    expect(jobs).toEqual([]);
  });

  it("AbortError → array vazio sem throw", async () => {
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).endsWith("/robots.txt"))
        return makeOkResponse(ROBOTS_OK, "text/plain");
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    });
    const { searchVagasCom } = await import("@/lib/jobs/providers/vagas-com");
    const jobs = await searchVagasCom({ role: "engenheiro", limit: 5 });
    expect(jobs).toEqual([]);
  });

  it("robots.txt Disallow:/ bloqueia fetch da pagina", async () => {
    let pageFetched = false;
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).endsWith("/robots.txt")) {
        return makeOkResponse(ROBOTS_BLOCK, "text/plain");
      }
      pageFetched = true;
      return makeOkResponse(SAMPLE_HTML);
    });
    const { searchVagasCom } = await import("@/lib/jobs/providers/vagas-com");
    const jobs = await searchVagasCom({ role: "engenheiro", limit: 5 });
    expect(jobs).toEqual([]);
    expect(pageFetched).toBe(false);
  });

  it("robots.txt Disallow: /vagas-de-engenheiro bloqueia este role", async () => {
    let pageFetched = false;
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).endsWith("/robots.txt")) {
        return makeOkResponse(ROBOTS_BLOCK_VAGAS, "text/plain");
      }
      pageFetched = true;
      return makeOkResponse(SAMPLE_HTML);
    });
    const { searchVagasCom } = await import("@/lib/jobs/providers/vagas-com");
    const jobs = await searchVagasCom({ role: "engenheiro", limit: 5 });
    expect(jobs).toEqual([]);
    expect(pageFetched).toBe(false);
  });

  it("cache hit retorna sem novo fetch", async () => {
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).endsWith("/robots.txt"))
        return makeOkResponse(ROBOTS_OK, "text/plain");
      return makeOkResponse(SAMPLE_HTML);
    });
    const { searchVagasCom } = await import("@/lib/jobs/providers/vagas-com");
    const a = await searchVagasCom({ role: "engenheiro", limit: 5 });
    const callsAfterFirst = fetchSpy.mock.calls.length;
    expect(a.length).toBeGreaterThan(0);
    const b = await searchVagasCom({ role: "engenheiro", limit: 5 });
    expect(b).toEqual(a);
    expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst);
  });

  it("dedup local: nao retorna mesmo data-id-vaga duas vezes", async () => {
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).endsWith("/robots.txt"))
        return makeOkResponse(ROBOTS_OK, "text/plain");
      return makeOkResponse(SAMPLE_HTML);
    });
    const { searchVagasCom } = await import("@/lib/jobs/providers/vagas-com");
    const jobs = await searchVagasCom({ role: "engenheiro", limit: 50 });
    const ids = jobs.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("vagas-com provider — internals", () => {
  it("roleToSlug normaliza acentos e espacos", async () => {
    const { __test } = await import("@/lib/jobs/providers/vagas-com");
    expect(__test.roleToSlug("Engenheiro de Dados")).toBe("engenheiro-de-dados");
    expect(__test.roleToSlug("UX/UI Designer")).toBe("uxui-designer");
    expect(__test.roleToSlug("  Análise  Sênior  ")).toBe("analise-senior");
    expect(__test.roleToSlug("")).toBe("");
  });

  it("parsePostedAt entende dd/mm/yyyy", async () => {
    const { __test } = await import("@/lib/jobs/providers/vagas-com");
    expect(__test.parsePostedAt("11/06/2026")).toBe("2026-06-11");
    expect(__test.parsePostedAt("01/01/2025")).toBe("2025-01-01");
    expect(__test.parsePostedAt("invalido")).toBeNull();
    expect(__test.parsePostedAt("")).toBeNull();
  });

  it("parsePostedAt entende 'Ha N dias' (relativo)", async () => {
    const { __test } = await import("@/lib/jobs/providers/vagas-com");
    const r = __test.parsePostedAt("Há 6 dias");
    expect(r).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const r2 = __test.parsePostedAt("Ha 1 hora");
    expect(r2).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("parseListings extrai 3 vagas do fixture", async () => {
    const { __test } = await import("@/lib/jobs/providers/vagas-com");
    const jobs = __test.parseListings(SAMPLE_HTML);
    expect(jobs.length).toBe(3);
    expect(jobs[0].titulo).toBe("Engenheiro Pleno I V027435");
    expect(jobs[0].empresa).toBe("Lyon Engenharia");
    expect(jobs[0].local).toBe("Belo Horizonte / MG");
    expect(jobs[0].url).toBe(
      "https://www.vagas.com.br/vagas/v2819876/engenheiro-pleno-i-v027435"
    );
  });

  it("parseListings descarta blocos sem id/href/title", async () => {
    const { __test } = await import("@/lib/jobs/providers/vagas-com");
    const bad = `<li class="vaga even "><div>missing fields</div></li>`;
    expect(__test.parseListings(bad)).toEqual([]);
  });

  it("parseRobotsDisallows ignora regras de outros user-agents", async () => {
    const { __test } = await import("@/lib/jobs/providers/vagas-com");
    const rules = __test.parseRobotsDisallows(
      "User-agent: Bytespider\nDisallow: /\nUser-agent: *\nDisallow: /admin\n"
    );
    expect(rules).toEqual(["/admin"]);
  });

  it("USER_AGENT identifica CareerTwin", async () => {
    const { __test } = await import("@/lib/jobs/providers/vagas-com");
    expect(__test.USER_AGENT).toContain("CareerTwin");
  });
});
