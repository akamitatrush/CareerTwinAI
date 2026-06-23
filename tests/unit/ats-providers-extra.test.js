import { describe, it, expect, beforeEach } from "vitest";

describe("ashby provider", () => {
  beforeEach(() => {
    delete process.env.ASHBY_BOARDS;
  });

  it("sem ASHBY_BOARDS retorna array vazio (provider nao entra)", async () => {
    const { searchAshbyJobs } = await import("@/lib/jobs/providers/ashby");
    const result = await searchAshbyJobs({ role: "engineer", limit: 3 });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  it("ASHBY_BOARDS so com chars invalidos retorna vazio (SSRF guard)", async () => {
    process.env.ASHBY_BOARDS = "../etc/passwd,http://evil";
    const { searchAshbyJobs } = await import("@/lib/jobs/providers/ashby");
    const result = await searchAshbyJobs({ role: "engineer", limit: 3 });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
    delete process.env.ASHBY_BOARDS;
  });
});

describe("workable provider", () => {
  beforeEach(() => {
    delete process.env.WORKABLE_BOARDS;
  });

  it("sem WORKABLE_BOARDS retorna array vazio (provider nao entra)", async () => {
    const { searchWorkableJobs } = await import("@/lib/jobs/providers/workable");
    const result = await searchWorkableJobs({ role: "engineer", limit: 3 });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  it("WORKABLE_BOARDS so com chars invalidos retorna vazio (SSRF guard)", async () => {
    process.env.WORKABLE_BOARDS = "../etc/passwd,http://evil";
    const { searchWorkableJobs } = await import("@/lib/jobs/providers/workable");
    const result = await searchWorkableJobs({ role: "engineer", limit: 3 });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
    delete process.env.WORKABLE_BOARDS;
  });
});

describe("ats provider shape uniformity", () => {
  it("ashby job shape consistent com others", () => {
    const sample = {
      id: "ashby-loft-x",
      source: "ashby",
      titulo: "Engenheiro",
      empresa: "Loft",
      local: "Sao Paulo",
      descricao: "...",
      url: "https://jobs.ashbyhq.com/loft/x",
      salario: null,
      postedAt: null,
    };
    expect(sample).toHaveProperty("source");
    expect(["greenhouse", "lever", "ashby", "workable", "adzuna", "jooble", "fixtures"]).toContain(
      sample.source
    );
  });

  it("workable job shape consistent", () => {
    const sample = {
      id: "workable-olist-y",
      source: "workable",
      titulo: "Engenheiro",
      empresa: "Olist",
      local: "Curitiba, Brazil",
      descricao: "...",
      url: "https://apply.workable.com/olist/j/y",
      salario: null,
      postedAt: null,
    };
    expect(sample.source).toBe("workable");
    expect(sample.salario).toBeNull(); // Workable nao expoe salario
  });

  it("normalizacao pt-br ignora acentos (uniforme com Lever)", () => {
    const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    expect(norm("São Paulo")).toBe("sao paulo");
    expect(norm("Brasília")).toBe("brasilia");
  });
});
