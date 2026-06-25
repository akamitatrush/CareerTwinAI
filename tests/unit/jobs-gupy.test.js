import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cacheClear } from "@/lib/jobs/cache";

const SAMPLE_HTML = readFileSync(
  path.resolve(__dirname, "../fixtures/gupy-sample.html"),
  "utf8"
);

// robots.txt permissivo (so define user-agent: * sem Disallow geral). Os blocos
// originais do Gupy.io listam Disallow muito especificos (preview, blog/page)
// que NAO cobrem `/` da home de subdominio.
const ROBOTS_OK = "User-agent: *\nDisallow: /preview/\nAllow: /";

// robots.txt que proibe tudo — simula site que opta por nao ser scraped.
const ROBOTS_BLOCK = "User-agent: *\nDisallow: /";

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

describe("gupy provider", () => {
  let fetchSpy;

  beforeEach(() => {
    cacheClear();
    // GUPY_BOARDS=default ativa allowlist embutida; usamos boards customizados nos testes.
    delete process.env.GUPY_BOARDS;
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    if (fetchSpy) fetchSpy.mockRestore();
    fetchSpy = null;
    vi.resetModules();
  });

  it("sem GUPY_BOARDS retorna [] sem fetch (provider desativado)", async () => {
    fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(makeOkResponse(""));
    const { searchGupy } = await import("@/lib/jobs/providers/gupy");
    const r = await searchGupy({ role: "engenheiro", limit: 5 });
    expect(r).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("GUPY_BOARDS so com chars invalidos retorna vazio (SSRF guard)", async () => {
    process.env.GUPY_BOARDS = "../etc/passwd,http://evil.com,evil$$";
    fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(makeOkResponse(""));
    const { searchGupy } = await import("@/lib/jobs/providers/gupy");
    const r = await searchGupy({ role: "engenheiro", limit: 5 });
    expect(r).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("HTML SSR valido com __NEXT_DATA__ extrai jobs com schema correto", async () => {
    process.env.GUPY_BOARDS = "lojasrenner";
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).endsWith("/robots.txt")) {
        return makeOkResponse(ROBOTS_OK, "text/plain");
      }
      return makeOkResponse(SAMPLE_HTML);
    });
    const { searchGupy } = await import("@/lib/jobs/providers/gupy");
    const jobs = await searchGupy({ role: "engenheiro", limit: 10 });
    expect(jobs.length).toBeGreaterThan(0);
    for (const j of jobs) {
      expect(j.source).toBe("gupy");
      expect(typeof j.titulo).toBe("string");
      expect(j.titulo.length).toBeGreaterThan(0);
      expect(j.url).toMatch(/^https:\/\/lojasrenner\.gupy\.io\/jobs\/\d+/);
      expect(j.url).toContain("jobBoardSource=gupy_public_page");
      expect(j.empresa).toBe("Lojas Renner S.A.");
      expect(j.id).toMatch(/^gupy-lojasrenner-\d+/);
      expect(j.salario).toBeNull();
    }
  });

  it("workplaceType remote marca local com '(Remoto)'", async () => {
    process.env.GUPY_BOARDS = "lojasrenner";
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).endsWith("/robots.txt"))
        return makeOkResponse(ROBOTS_OK, "text/plain");
      return makeOkResponse(SAMPLE_HTML);
    });
    const { searchGupy } = await import("@/lib/jobs/providers/gupy");
    const jobs = await searchGupy({ role: "engenheiro", limit: 10 });
    const remoto = jobs.find((j) => /remoto/i.test(j.local));
    expect(remoto).toBeTruthy();
    expect(remoto.titulo).toContain("Dados");
  });

  it("HTML malformado (sem __NEXT_DATA__) retorna [] sem throw", async () => {
    process.env.GUPY_BOARDS = "lojasrenner";
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).endsWith("/robots.txt"))
        return makeOkResponse(ROBOTS_OK, "text/plain");
      return makeOkResponse("<html><body>oops</body></html>");
    });
    const { searchGupy } = await import("@/lib/jobs/providers/gupy");
    const jobs = await searchGupy({ role: "engenheiro", limit: 5 });
    expect(jobs).toEqual([]);
  });

  it("fetch retorna 500 → array vazio sem throw", async () => {
    process.env.GUPY_BOARDS = "lojasrenner";
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).endsWith("/robots.txt"))
        return makeOkResponse(ROBOTS_OK, "text/plain");
      return makeErrResponse(500);
    });
    const { searchGupy } = await import("@/lib/jobs/providers/gupy");
    const jobs = await searchGupy({ role: "engenheiro", limit: 5 });
    expect(jobs).toEqual([]);
  });

  it("AbortError no fetch retorna [] sem throw", async () => {
    process.env.GUPY_BOARDS = "lojasrenner";
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).endsWith("/robots.txt"))
        return makeOkResponse(ROBOTS_OK, "text/plain");
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    });
    const { searchGupy } = await import("@/lib/jobs/providers/gupy");
    const jobs = await searchGupy({ role: "engenheiro", limit: 5 });
    expect(jobs).toEqual([]);
  });

  it("robots.txt Disallow:/ bloqueia fetch da pagina", async () => {
    process.env.GUPY_BOARDS = "evilboard";
    let pageFetched = false;
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).endsWith("/robots.txt")) {
        return makeOkResponse(ROBOTS_BLOCK, "text/plain");
      }
      pageFetched = true;
      return makeOkResponse(SAMPLE_HTML);
    });
    const { searchGupy } = await import("@/lib/jobs/providers/gupy");
    const jobs = await searchGupy({ role: "engenheiro", limit: 5 });
    expect(jobs).toEqual([]);
    expect(pageFetched).toBe(false);
  });

  it("cache hit retorna sem novo fetch", async () => {
    process.env.GUPY_BOARDS = "lojasrenner";
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).endsWith("/robots.txt"))
        return makeOkResponse(ROBOTS_OK, "text/plain");
      return makeOkResponse(SAMPLE_HTML);
    });
    const { searchGupy } = await import("@/lib/jobs/providers/gupy");
    const a = await searchGupy({ role: "engenheiro", limit: 5 });
    const callsAfterFirst = fetchSpy.mock.calls.length;
    expect(a.length).toBeGreaterThan(0);
    const b = await searchGupy({ role: "engenheiro", limit: 5 });
    expect(b).toEqual(a);
    expect(fetchSpy.mock.calls.length).toBe(callsAfterFirst);
  });

  it("filtra por role nos titulos (backend → titulo com 'Backend')", async () => {
    process.env.GUPY_BOARDS = "lojasrenner";
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      if (String(url).endsWith("/robots.txt"))
        return makeOkResponse(ROBOTS_OK, "text/plain");
      return makeOkResponse(SAMPLE_HTML);
    });
    const { searchGupy } = await import("@/lib/jobs/providers/gupy");
    const jobs = await searchGupy({ role: "backend", limit: 10 });
    expect(jobs.length).toBeGreaterThan(0);
    for (const j of jobs) {
      // Match no titulo OU no department (descricao).
      const hay = `${j.titulo} ${j.descricao || ""}`.toLowerCase();
      expect(hay).toMatch(/backend|tecnologia|dados/);
    }
  });

  it("GUPY_BOARDS=default usa allowlist embutida (>= 3 hosts probados)", async () => {
    process.env.GUPY_BOARDS = "default";
    const probedHosts = new Set();
    fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (url) => {
      const u = new URL(String(url));
      probedHosts.add(u.host);
      if (u.pathname === "/robots.txt") return makeOkResponse(ROBOTS_OK, "text/plain");
      return makeOkResponse(SAMPLE_HTML);
    });
    const { searchGupy } = await import("@/lib/jobs/providers/gupy");
    const jobs = await searchGupy({ role: "engenheiro", limit: 30 });
    // Default tem 9 subdominios; cada um vira 3 jobs no sample.
    expect(probedHosts.size).toBeGreaterThanOrEqual(3);
    expect(jobs.length).toBeGreaterThan(0);
  });
});

describe("gupy provider — internals (test helpers)", () => {
  it("parseRobotsDisallows captura apenas regras de user-agent: *", async () => {
    const { __test } = await import("@/lib/jobs/providers/gupy");
    const rules = __test.parseRobotsDisallows(
      "User-agent: *\nDisallow: /admin\nDisallow: /private\nUser-agent: GPTBot\nDisallow: /\n"
    );
    expect(rules).toEqual(["/admin", "/private"]);
  });

  it("pathDisallowed cobre wildcard com '*?*'", async () => {
    const { __test } = await import("@/lib/jobs/providers/gupy");
    expect(__test.pathDisallowed(["/*?*utm_*"], "/jobs?utm_source=test")).toBe(true);
    expect(__test.pathDisallowed(["/admin"], "/admin/users")).toBe(true);
    expect(__test.pathDisallowed(["/admin"], "/jobs")).toBe(false);
  });

  it("workplaceToLocal formata cidade + UF + tipo", async () => {
    const { __test } = await import("@/lib/jobs/providers/gupy");
    expect(
      __test.workplaceToLocal({
        address: { city: "São Paulo", stateShortName: "SP" },
        workplaceType: "hybrid",
      })
    ).toBe("São Paulo, SP (Hibrido)");
    expect(__test.workplaceToLocal({})).toBe("Brasil");
  });

  it("USER_AGENT identifica CareerTwin", async () => {
    const { __test } = await import("@/lib/jobs/providers/gupy");
    expect(__test.USER_AGENT).toContain("CareerTwin");
  });

  it("shape() rejeita jobs sem id ou title", async () => {
    const { __test } = await import("@/lib/jobs/providers/gupy");
    expect(__test.shape({}, "x", {})).toBeNull();
    expect(__test.shape({ id: 1 }, "x", {})).toBeNull();
    expect(__test.shape({ title: "x" }, "x", {})).toBeNull();
    const ok = __test.shape(
      { id: 99, title: "Dev", workplace: {} },
      "company",
      { publicationName: "Empresa Co" }
    );
    expect(ok.empresa).toBe("Empresa Co");
    expect(ok.source).toBe("gupy");
  });
});
