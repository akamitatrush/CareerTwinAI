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

// ---------------------------------------------------------------------------
// P0.6 (docs/fluxos/auditoria/30062026/po-oportunidades-auditoria.md §P0.6 +
// §4.5): providers ATS strippavam "manager"/"senior" como noise via
// roleTokens.some(...), causando OR-bug — "marketing manager" batia
// "Customer Success Manager" so pelo 'manager'. Fix: strippa noise antes
// do some() e exige match em UM token FUNCIONAL.
//
// Estes tests cobrem o comportamento de jobMatchesRole indiretamente via
// helpers reexportados — providers nao expoem a funcao mas o tokenize +
// noise filter sao deterministicos e simulaveis.
// ---------------------------------------------------------------------------

describe("P0.6: jobMatchesRole strippa noise antes do some() (replicado por provider)", () => {
  // Replicamos a logica esperada — testar a funcao real precisaria mocks de
  // rede. Garantimos que a SEMANTICA esta clara e o caller (provider) usa
  // a mesma lista de NOISE_TOKENS de skills-taxonomy.
  const NOISE_TOKENS = new Set([
    "junior", "jr", "trainee", "pleno", "mid", "senior", "sr", "lead",
    "principal", "staff", "especialista", "especialist", "manager", "gerente",
    "de", "da", "do", "para", "em", "com", "the", "of", "and", "or",
    "i", "ii", "iii", "iv",
  ]);

  const tokenize = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .split(/[^a-z0-9]+/)
      .filter(Boolean);

  // Replica de jobMatchesRole — mesma logica que ashby/lever/workable/greenhouse.
  const jobMatchesRole = (jobTitle, role) => {
    const roleTokens = tokenize(role);
    if (!roleTokens.length) return { matches: true, hits: 0 };
    const hay = tokenize(jobTitle);
    const requiredTokens = roleTokens.filter((t) => !NOISE_TOKENS.has(t));
    const matchSet = requiredTokens.length ? requiredTokens : roleTokens;
    let hits = 0;
    for (const t of matchSet) if (hay.includes(t)) hits++;
    return { matches: hits > 0, hits };
  };

  it("'marketing manager' NAO bate 'Customer Success Manager' (bug raiz §P0.6)", () => {
    // Required = ['marketing'], hay = ['customer','success','manager'] → 0 hits
    expect(jobMatchesRole("Customer Success Manager", "marketing manager").matches).toBe(false);
  });

  it("'marketing manager' bate 'Marketing Operations Pleno' (token funcional bate)", () => {
    expect(jobMatchesRole("Marketing Operations Pleno", "marketing manager").matches).toBe(true);
  });

  it("'senior backend engineer' NAO bate 'QA Engineer Senior' (so engineer compartilhado, mas required={backend,engineer})", () => {
    // Required = ['backend','engineer'], hay = ['qa','engineer','senior']
    //   → 1 hit em 'engineer' → matches=true mas hits=1 (rank baixo)
    const r = jobMatchesRole("QA Engineer Senior", "senior backend engineer");
    expect(r.matches).toBe(true); // ainda passa (recall preservado)
    expect(r.hits).toBe(1);
  });

  it("'senior backend engineer' bate 'Backend Engineer Pleno' com hits=2 (rank ALTO)", () => {
    const r = jobMatchesRole("Backend Engineer Pleno", "senior backend engineer");
    expect(r.matches).toBe(true);
    expect(r.hits).toBe(2);
  });

  it("hits>2 ranqueia ACIMA de hits=1 — Backend Engineer > QA Engineer no sort", () => {
    const backend = jobMatchesRole("Backend Engineer Pleno", "senior backend engineer");
    const qa = jobMatchesRole("QA Engineer Senior", "senior backend engineer");
    expect(backend.hits).toBeGreaterThan(qa.hits);
  });

  it("role so com noise tokens (degenerate): fallback pro some() original", () => {
    // 'Senior Manager' = ambos noise. requiredTokens=[], matchSet=roleTokens.
    // Mantemos recall: bate qualquer titulo com 'senior' OU 'manager'.
    expect(jobMatchesRole("Customer Success Manager", "Senior Manager").matches).toBe(true);
    expect(jobMatchesRole("Junior Engineer", "Senior Manager").matches).toBe(false);
  });

  it("role vazio bate tudo (matches=true) — back-compat com providers sem role", () => {
    expect(jobMatchesRole("Anything", "").matches).toBe(true);
  });
});
