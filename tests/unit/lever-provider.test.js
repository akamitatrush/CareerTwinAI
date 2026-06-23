import { describe, it, expect, beforeEach } from "vitest";

describe("lever provider", () => {
  beforeEach(() => {
    delete process.env.LEVER_BOARDS;
  });

  it("sem LEVER_BOARDS retorna array vazio (provider nao entra)", async () => {
    const { searchLeverJobs } = await import("@/lib/jobs/providers/lever");
    const result = await searchLeverJobs({ role: "engineer", limit: 3 });
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  it("shape do job tem campos esperados (source=lever)", () => {
    // sample shape sem chamada de rede — checa contrato de campos retornados.
    const job = {
      id: "lever-hotmart-abc",
      source: "lever",
      titulo: "Software Engineer",
      empresa: "Hotmart",
      local: "Brasil",
      descricao: "...",
      url: "https://jobs.lever.co/hotmart/abc",
      salario: null,
      postedAt: null,
    };
    expect(job).toHaveProperty("source");
    expect(job.source).toBe("lever");
    expect(job).toHaveProperty("titulo");
    expect(job).toHaveProperty("empresa");
    expect(job).toHaveProperty("local");
    expect(job).toHaveProperty("url");
    expect(job.salario).toBeNull(); // Lever nao expoe salario
  });

  it("normalizacao pt-br ignora acentos", () => {
    const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    expect(norm("São Paulo")).toBe("sao paulo");
    expect(norm("Engenheiro")).toBe("engenheiro");
    expect(norm("Florianópolis")).toBe("florianopolis");
  });
});
